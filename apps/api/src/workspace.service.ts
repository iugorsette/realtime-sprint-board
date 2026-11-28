import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ColumnColor, MemberRole, RenameBoard } from '@board/shared';
import { initials, publicAccount, type Identity } from './auth';
import { Database } from './database';
import type { Prisma } from './generated/prisma/client';

type Transaction = Prisma.TransactionClient;
const starterColumns = [
  { name: 'Backlog', color: 'RED' },
  { name: 'Todo', color: 'AMBER' },
  { name: 'In Progress', color: 'PURPLE' },
  { name: 'Done', color: 'GREEN' },
] satisfies { name: string; color: ColumnColor }[];
const accountDetails = { id: true, name: true } as const;

export function visibleBoards(accountId: string): Prisma.BoardWhereInput {
  return { OR: [{ ownerId: accountId }, { members: { some: { accountId } } }] };
}

export async function requireBoard(tx: Transaction, boardId: string, accountId: string, permission: 'read' | 'edit' | 'manage') {
  const board = await tx.board.findFirst({ where: { id: boardId, ...visibleBoards(accountId) },
    select: { ownerId: true, members: { where: { accountId }, select: { role: true } } } });
  if (!board) throw new NotFoundException('Board not found.');
  if (board.ownerId === accountId) return 'OWNER';
  const role = board.members[0]?.role;
  if (!role || permission === 'manage' || (permission === 'edit' && role !== 'EDITOR')) throw new ForbiddenException('Access denied.');
  return role;
}

export async function lockBoard(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT id FROM boards WHERE id = ${id} FOR UPDATE`;
}

async function lockAccount(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${id} FOR UPDATE`;
}

function avatarBytes(value: string) {
  const buffer = Buffer.from(value, 'base64');
  const validHeader = buffer.length >= 45 && buffer.length <= 65_536
    && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && buffer.readUInt32BE(8) === 13 && buffer.toString('ascii', 12, 16) === 'IHDR'
    && buffer.readUInt32BE(16) > 0 && buffer.readUInt32BE(16) <= 160
    && buffer.readUInt32BE(20) > 0 && buffer.readUInt32BE(20) <= 160;
  if (!validHeader) throw new BadRequestException('Choose a PNG avatar up to 160 pixels and 64 KB.');
  return new Uint8Array(buffer);
}

@Injectable()
export class WorkspaceService {
  constructor(private readonly database: Database) {}

  async account(id: string) {
    return publicAccount(await this.database.client.account.findUniqueOrThrow({ where: { id } }));
  }

  profile(id: string, name: string, avatar?: string | null) {
    const bytes = avatar == null ? avatar : avatarBytes(avatar);
    return this.database.client.$transaction(async (tx) => {
      await lockAccount(tx, id);
      const account = await tx.account.update({ where: { id }, data: { name, avatar: bytes } });
      const active = { accountId: id, board: visibleBoards(id) };
      const assignees = await tx.assignee.findMany({ where: active, select: { boardId: true } });
      await tx.assignee.updateMany({ where: active, data: { name, initials: initials(name) } });
      return { account: publicAccount(account), boardIds: assignees.map(({ boardId }) => boardId) };
    });
  }

  async workspace(identity: Identity) {
    const db = this.database.client;
    const [boards, invitations] = await Promise.all([
      db.board.findMany({ where: visibleBoards(identity.id), orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, ownerId: true, members: { where: { accountId: identity.id }, select: { role: true } } } }),
      db.boardInvite.findMany({ where: { email: identity.email, expiresAt: { gt: new Date() }, board: {
        NOT: visibleBoards(identity.id),
      } }, select: { role: true, board: { select: { id: true, name: true } } } }),
    ]);
    return { boards: boards.flatMap(({ id, name, ownerId, members }) => {
      const role = ownerId === identity.id ? 'OWNER' as const : members[0]?.role;
      return role ? [{ id, name, role }] : [];
    }), invitations: invitations.map(({ board, role }) => ({ ...board, role })) };
  }

  createBoard(accountId: string, name: string) {
    return this.database.client.$transaction(async (tx) => {
      await lockAccount(tx, accountId);
      if (await tx.board.count({ where: { ownerId: accountId } }) >= 5) {
        throw new BadRequestException('You can own up to five boards.');
      }
      const account = await tx.account.findUniqueOrThrow({ where: { id: accountId }, select: { name: true } });
      const board = await tx.board.create({ data: {
        id: crypto.randomUUID(), name, ownerId: accountId,
        columns: { create: starterColumns.map((column, position) => ({ ...column, position })) },
        assignees: { create: { accountId, name: account.name || 'Board owner', initials: initials(account.name) } },
      }, select: { id: true, name: true } });
      return { ...board, role: 'OWNER' as const };
    });
  }

  private changeBoard(boardId: string, accountId: string, expectedName: string,
    write: (tx: Transaction, where: { id: string; name: string }) => Promise<{ count: number }>) {
    return this.database.client.$transaction(async (tx) => {
      await lockBoard(tx, boardId);
      await requireBoard(tx, boardId, accountId, 'manage');
      const result = await write(tx, { id: boardId, name: expectedName });
      if (!result.count) throw new ConflictException('This board changed. Reopen its settings and try again.');
    });
  }

  renameBoard(boardId: string, accountId: string, { name, expectedName }: RenameBoard) {
    return this.changeBoard(boardId, accountId, expectedName, (tx, where) =>
      tx.board.updateMany({ where, data: { name, revision: { increment: 1 } } }));
  }

  deleteBoard(boardId: string, accountId: string, expectedName: string) {
    return this.changeBoard(boardId, accountId, expectedName, (tx, where) => tx.board.deleteMany({ where }));
  }

  async locateCard(cardId: string, accountId: string) {
    const card = await this.database.client.card.findFirst({ where: { id: cardId,
      column: { board: visibleBoards(accountId) } }, select: { column: { select: { boardId: true } } } });
    if (!card) throw new NotFoundException('Card not found.');
    return { boardId: card.column.boardId };
  }

  members(boardId: string, accountId: string) {
    return this.database.client.$transaction(async (tx) => {
      await requireBoard(tx, boardId, accountId, 'manage');
      const board = await tx.board.findUniqueOrThrow({ where: { id: boardId }, select: {
        owner: { select: accountDetails },
        members: { select: { role: true, account: { select: accountDetails } } },
        invites: { where: { expiresAt: { gt: new Date() } }, select: { email: true, role: true } },
      } });
      const owner = board.owner ? [{ ...board.owner, role: 'OWNER' as const }] : [];
      return { people: [...owner, ...board.members.map(({ account, role }) => ({ ...account, role }))], invitations: board.invites };
    }, { isolationLevel: 'RepeatableRead' });
  }

  invite(boardId: string, identity: Identity, email: string, role: MemberRole) {
    return this.database.client.$transaction(async (tx) => {
      await lockBoard(tx, boardId);
      await requireBoard(tx, boardId, identity.id, 'manage');
      if (identity.email === email || await tx.boardMember.count({ where: { boardId, account: { email } } })) {
        throw new BadRequestException('This person already has access.');
      }
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000);
      await tx.boardInvite.upsert({ where: { boardId_email: { boardId, email } },
        create: { boardId, email, role, expiresAt }, update: { role, expiresAt } });
    });
  }

  accept(boardId: string, identity: Identity) {
    return this.database.client.$transaction(async (tx) => {
      await lockAccount(tx, identity.id);
      await lockBoard(tx, boardId);
      if (await tx.boardMember.count({ where: { boardId, accountId: identity.id } })) return;
      const invite = await tx.boardInvite.findUnique({ where: { boardId_email: { boardId, email: identity.email },
        expiresAt: { gt: new Date() }, board: { ownerId: { not: identity.id } } } });
      if (!invite) throw new NotFoundException('Invitation not found.');
      if (await tx.boardMember.count({ where: { accountId: identity.id } }) >= 10) {
        throw new BadRequestException('You can join up to ten shared boards.');
      }
      const account = await tx.account.findUniqueOrThrow({ where: { id: identity.id }, select: { name: true } });
      await tx.boardMember.create({ data: { boardId, accountId: identity.id, role: invite.role } });
      await tx.assignee.upsert({ where: { boardId_accountId: { boardId, accountId: identity.id } },
        create: { boardId, accountId: identity.id, name: account.name || 'Board member', initials: initials(account.name) },
        update: { name: account.name || 'Board member', initials: initials(account.name) } });
      await tx.boardInvite.delete({ where: { boardId_email: { boardId, email: identity.email } } });
    });
  }

  revokeInvite(boardId: string, ownerId: string, email: string) {
    return this.database.client.$transaction(async (tx) => {
      await lockBoard(tx, boardId);
      await requireBoard(tx, boardId, ownerId, 'manage');
      await tx.boardInvite.deleteMany({ where: { boardId, email } });
    });
  }

  changeMember(boardId: string, actorId: string, accountId: string, role?: MemberRole) {
    return this.database.client.$transaction(async (tx) => {
      await lockAccount(tx, accountId);
      await lockBoard(tx, boardId);
      await requireBoard(tx, boardId, actorId, actorId === accountId && !role ? 'read' : 'manage');
      if (role) await tx.boardMember.updateMany({ where: { boardId, accountId }, data: { role } });
      else {
        await tx.boardMember.deleteMany({ where: { boardId, accountId } });
        // Retain historic assignees for existing cards. They no longer have access to the board.
      }
    });
  }
}
