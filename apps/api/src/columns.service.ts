import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateColumn, RenameColumn } from '@board/shared';
import { Database } from './database';
import type { Prisma } from './generated/prisma/client';
import { lockBoard, requireBoard } from './workspace.service';

type Transaction = Prisma.TransactionClient;

@Injectable()
export class ColumnsService {
  constructor(private readonly database: Database) {}

  private change(boardId: string, accountId: string, write: (tx: Transaction) => Promise<void>) {
    return this.database.client.$transaction(async (tx) => {
      await lockBoard(tx, boardId);
      await requireBoard(tx, boardId, accountId, 'manage');
      await write(tx);
      await tx.board.update({ where: { id: boardId }, data: { revision: { increment: 1 } } });
    });
  }

  private async checkName(tx: Transaction, boardId: string, name: string, exceptId?: string) {
    const duplicate = await tx.column.findFirst({
      where: { boardId, name, id: exceptId ? { not: exceptId } : undefined },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('A column with this name already exists.');
  }

  private async checkCurrent(tx: Transaction, boardId: string, id: string, expectedName: string) {
    const column = await tx.column.findUnique({ where: { id, boardId }, select: { name: true } });
    if (!column) throw new NotFoundException('Column not found.');
    if (column.name !== expectedName) throw new ConflictException('This column changed. Reopen its settings and try again.');
  }

  create(boardId: string, accountId: string, { name }: CreateColumn) {
    return this.change(boardId, accountId, async (tx) => {
      await this.checkName(tx, boardId, name);
      const last = await tx.column.findFirst({
        where: { boardId }, orderBy: { position: 'desc' }, select: { position: true },
      });
      await tx.column.create({ data: { boardId, name, position: (last?.position ?? -1) + 1 } });
    });
  }

  rename(boardId: string, accountId: string, id: string, { name, expectedName }: RenameColumn) {
    return this.change(boardId, accountId, async (tx) => {
      await this.checkCurrent(tx, boardId, id, expectedName);
      await this.checkName(tx, boardId, name, id);
      await tx.column.update({ where: { id, boardId }, data: { name } });
    });
  }

  delete(boardId: string, accountId: string, id: string, expectedName: string) {
    return this.change(boardId, accountId, async (tx) => {
      await this.checkCurrent(tx, boardId, id, expectedName);
      if (await tx.column.count({ where: { boardId } }) <= 1) {
        throw new ConflictException('The board must have at least one column.');
      }
      const result = await tx.column.deleteMany({ where: { id, boardId, cards: { none: {} } } });
      if (!result.count) throw new ConflictException('Move all cards out of this column before deleting it.');
    });
  }
}
