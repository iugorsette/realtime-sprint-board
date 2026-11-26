import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  calculateMidpointPosition, comparePositions, needsRebalancing, rebalancePositions,
  type Board, type BoardChange, type Card, type CardConflict, type CreateCard,
  type MoveCard, type UpdateCard,
} from '@board/shared';
import { Database } from './database';
import type { Prisma } from './generated/prisma/client';

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

  async board(id: string): Promise<Board> {
    return this.database.client.$transaction(async (tx) => {
      const board = await tx.board.findUnique({
        where: { id },
        select: {
          id: true, name: true, revision: true,
          assignees: { orderBy: { name: 'asc' }, select: { id: true, name: true, initials: true } },
          columns: {
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
            select: { id: true, name: true, position: true, cards: { orderBy: [{ position: 'asc' }, { id: 'asc' }], include: withAssignments } },
          },
        },
      });
      if (!board) throw new NotFoundException('Board not found');
      return { ...board, columns: board.columns.map((column) => ({ ...column, cards: column.cards.map(toCard) })) };
    }, { isolationLevel: 'RepeatableRead' });
  }

  async exists(id: string) {
    return (await this.database.client.board.count({ where: { id } })) > 0;
  }

  private async lockBoard(tx: Transaction, boardId: string) {
    await tx.$queryRaw`SELECT id FROM boards WHERE id = ${boardId} FOR UPDATE`;
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
    id: string,
    expectedVersion: number,
    change: (tx: Transaction, card: Card, boardId: string) => Promise<CardChanges | null>,
  ): Promise<BoardChange | null> {
    return this.database.client.$transaction(async (tx) => {
      const existing = await tx.card.findUnique({ where: { id }, select: { column: { select: { boardId: true } } } });
      if (!existing) throw conflict('CARD_VERSION_CONFLICT', null);
      const { boardId } = existing.column;
      await this.lockBoard(tx, boardId);
      const stored = await tx.card.findUnique({ where: { id }, include: withAssignments });
      const card = stored && toCard(stored);
      if (card?.version !== expectedVersion) throw conflict('CARD_VERSION_CONFLICT', card);
      const result = await change(tx, card, boardId);
      return result && this.commitChange(tx, boardId, result);
    });
  }

  async create({ assigneeIds, ...input }: CreateCard) {
    return this.database.client.$transaction(async (tx) => {
      const column = await tx.column.findUnique({ where: { id: input.columnId } });
      if (!column) throw new NotFoundException('Column not found');
      await this.lockBoard(tx, column.boardId);
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

  update(id: string, { expectedVersion, assigneeIds, ...fields }: UpdateCard) {
    return this.withCard(id, expectedVersion, async (tx, card, boardId) => {
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

  delete(id: string, expectedVersion: number) {
    return this.withCard(id, expectedVersion, async (tx) => {
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

  move(id: string, { expectedVersion, targetColumnId, beforeCardId }: MoveCard) {
    return this.withCard(id, expectedVersion, async (tx, card, boardId) => {
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
