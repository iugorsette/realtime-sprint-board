import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  calculateMidpointPosition, comparePositions, needsRebalancing, rebalancePositions,
  type Board, type BoardChange, type Card, type CardConflict, type CreateCard,
  type MoveCard, type UpdateCard,
} from '@board/shared';
import { Database } from './database';
import type { Prisma } from './generated/prisma/client';
import { lockBoard, requireBoard } from './workspace.service';

type Transaction = Prisma.TransactionClient;
const withAssignments = {
  assignments: { select: { assigneeId: true }, orderBy: { assigneeId: 'asc' } },
} satisfies Prisma.CardInclude;
type StoredCard = Prisma.CardGetPayload<{ include: typeof withAssignments }>;

function toCard({ assignments, ...card }: StoredCard): Card {
  return { ...card, assigneeIds: assignments.map(({ assigneeId }) => assigneeId) };
}

const positionFields = { id: true, columnId: true, position: true } as const;
type CardChanges = Pick<BoardChange, 'cards' | 'deletedCardIds'>;

function conflict(code: CardConflict['code'], card: Card | null) {
  return new ConflictException({ code, card } satisfies CardConflict);
}

@Injectable()
export class CardsService {
  constructor(private readonly database: Database) {}

  async board(id: string, accountId: string): Promise<Board> {
    return this.database.client.$transaction(async (tx) => {
      await requireBoard(tx, id, accountId, 'read');
      const board = await tx.board.findUnique({
        where: { id },
        select: {
          id: true, name: true, revision: true,
          assignees: { orderBy: { name: 'asc' }, select: { id: true, name: true, initials: true } },
          columns: {
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
            select: { id: true, name: true, position: true, color: true,
              cards: { orderBy: [{ position: 'asc' }, { id: 'asc' }], include: withAssignments } },
          },
        },
      });
      if (!board) throw new NotFoundException('Board not found');
      return { ...board, columns: board.columns.map((column) => ({ ...column, cards: column.cards.map(toCard) })) };
    }, { isolationLevel: 'RepeatableRead' });
  }

  private async commitChange(tx: Transaction, boardId: string, changes: CardChanges): Promise<BoardChange> {
    const { revision } = await tx.board.update({
      where: { id: boardId }, data: { revision: { increment: 1 } }, select: { revision: true },
    });
    return { boardId, revision, ...changes };
  }

  private async verifyAssignees(tx: Transaction, boardId: string, ids: string[]) {
    if (!ids.length) return;
    const count = await tx.assignee.count({ where: { id: { in: ids }, boardId } });
    if (count !== ids.length) throw new BadRequestException('Assignees must belong to the board');
  }

  private async withCard(
    boardId: string,
    accountId: string,
    id: string,
    expectedVersion: number,
    change: (tx: Transaction, card: Card) => Promise<CardChanges | null>,
  ): Promise<BoardChange | null> {
    return this.database.client.$transaction(async (tx) => {
      await lockBoard(tx, boardId);
      await requireBoard(tx, boardId, accountId, 'edit');
      const stored = await tx.card.findUnique({ where: { id, column: { boardId } }, include: withAssignments });
      const card = stored && toCard(stored);
      if (card?.version !== expectedVersion) throw conflict('CARD_VERSION_CONFLICT', card);
      const result = await change(tx, card);
      return result && this.commitChange(tx, boardId, result);
    });
  }

  async create(boardId: string, accountId: string, { assigneeIds, ...input }: CreateCard) {
    return this.database.client.$transaction(async (tx) => {
      await lockBoard(tx, boardId);
      await requireBoard(tx, boardId, accountId, 'edit');
      const column = await tx.column.findUnique({ where: { id: input.columnId, boardId } });
      if (!column) throw new NotFoundException('Column not found');
      if (input.id) {
        const { count } = await tx.cardCreation.createMany({
          data: { id: input.id, boardId: column.boardId }, skipDuplicates: true,
        });
        if (!count) {
          const receipt = await tx.cardCreation.findUnique({ where: { id: input.id } });
          if (receipt?.boardId !== column.boardId) throw new BadRequestException('Card ID is unavailable');
          return null;
        }
      }
      await this.verifyAssignees(tx, column.boardId, assigneeIds);

      const last = await tx.card.findFirst({
        where: { columnId: column.id }, orderBy: [{ position: 'desc' }, { id: 'desc' }],
      });
      const cards: Card[] = [];
      let previous = last?.position;
      if (needsRebalancing(previous)) {
        const ordered = await tx.card.findMany({ where: { columnId: column.id }, select: positionFields });
        ordered.sort(comparePositions);
        cards.push(...await this.rebalance(tx, ordered, column.id));
        previous = rebalancePositions(ordered).at(-1)?.position;
      }
      const created = await tx.card.create({
        data: {
          ...input,
          position: calculateMidpointPosition(previous),
          assignments: { create: assigneeIds.map((assigneeId) => ({ assigneeId })) },
        },
        include: withAssignments,
      });
      cards.push(toCard(created));
      return this.commitChange(tx, column.boardId, { cards, deletedCardIds: [] });
    });
  }

  update(boardId: string, accountId: string, id: string, { expectedVersion, assigneeIds, ...fields }: UpdateCard) {
    return this.withCard(boardId, accountId, id, expectedVersion, async (tx, card) => {
      await this.verifyAssignees(tx, boardId, assigneeIds);
      const added = assigneeIds.filter((assigneeId) => !card.assigneeIds.includes(assigneeId));
      const removed = card.assigneeIds.filter((assigneeId) => !assigneeIds.includes(assigneeId));
      const updated = await tx.card.update({
        where: { id: card.id },
        data: {
          ...fields,
          version: { increment: 1 },
          assignments: {
            deleteMany: { assigneeId: { in: removed } },
            create: added.map((assigneeId) => ({ assigneeId })),
          },
        },
        include: withAssignments,
      });
      return { cards: [toCard(updated)], deletedCardIds: [] };
    });
  }

  delete(boardId: string, accountId: string, id: string, expectedVersion: number) {
    return this.withCard(boardId, accountId, id, expectedVersion, async (tx) => {
      await tx.card.delete({ where: { id } });
      return { cards: [], deletedCardIds: [id] };
    });
  }

  private async rebalance(tx: Transaction, ordered: Pick<Card, 'id' | 'position' | 'columnId'>[], columnId: string) {
    const cards: Card[] = [];
    for (const [index, { id, position }] of rebalancePositions(ordered).entries()) {
      const card = ordered[index];
      if (card.position === position && card.columnId === columnId) continue;
      const updated = await tx.card.update({
        where: { id }, data: { position, columnId, version: { increment: 1 } }, include: withAssignments,
      });
      cards.push(toCard(updated));
    }
    return cards;
  }

  move(boardId: string, accountId: string, id: string, { expectedVersion, targetColumnId, beforeCardId }: MoveCard) {
    return this.withCard(boardId, accountId, id, expectedVersion, async (tx, card) => {
      const column = await tx.column.findFirst({ where: { id: targetColumnId, boardId } });
      if (!column) throw new NotFoundException('Destination column not found');
      if (beforeCardId === id) throw new BadRequestException('A card cannot be its own anchor');

      const ordered = await tx.card.findMany({ where: { columnId: targetColumnId }, select: positionFields });
      ordered.sort(comparePositions);
      const originalIndex = ordered.findIndex((item) => item.id === id);
      const neighbors = ordered.filter((item) => item.id !== id);
      const insertAt = beforeCardId === null ? neighbors.length : neighbors.findIndex((item) => item.id === beforeCardId);
      if (insertAt < 0) throw conflict('BOARD_ORDER_CHANGED', card);
      if (insertAt === originalIndex) return null;

      const previous = neighbors[insertAt - 1]?.position;
      const next = neighbors[insertAt]?.position;
      if (needsRebalancing(previous, next)) {
        neighbors.splice(insertAt, 0, card);
        return { cards: await this.rebalance(tx, neighbors, targetColumnId), deletedCardIds: [] };
      }

      const moved = await tx.card.update({
        where: { id },
        data: {
          columnId: targetColumnId, position: calculateMidpointPosition(previous, next),
          version: { increment: 1 },
        },
        include: withAssignments,
      });
      return { cards: [toCard(moved)], deletedCardIds: [] };
    });
  }
}
