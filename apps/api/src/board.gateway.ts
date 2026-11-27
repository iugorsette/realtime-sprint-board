import { Logger } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { idSchema, type BoardChange, type CardEvent, type ClientToServerEvents, type ServerToClientEvents } from '@board/shared';
import type { Server, Socket } from 'socket.io';
import { AuthService, browserOrigin, type Identity } from './auth';
import { Database } from './database';
import { visibleBoards } from './workspace.service';

type SocketData = { sessionDigest?: string };
type BoardServer = Server<ClientToServerEvents, ServerToClientEvents, Record<never, never>, SocketData>;
type BoardSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<never, never>, SocketData>;
const room = (boardId: string) => `board:${boardId}`;

@WebSocketGateway({
  transports: ['websocket'],
  allowRequest: (request: IncomingMessage, callback: (error: string | null, allowed: boolean) => void) =>
    callback(null, request.headers.origin === browserOrigin()),
})
export class BoardGateway {
  @WebSocketServer()
  private readonly server!: BoardServer;
  private readonly logger = new Logger(BoardGateway.name);

  constructor(private readonly auth: AuthService, private readonly database: Database) {}

  @SubscribeMessage('board:join')
  async join(@ConnectedSocket() socket: BoardSocket, @MessageBody() value: unknown) {
    const id = idSchema.safeParse(value);
    if (!id.success || socket.handshake.headers.origin !== browserOrigin()) return { ok: false };
    const identity = await this.auth.identity(socket.handshake.headers.cookie);
    if (!identity || !(await this.database.client.board.count({ where: { id: id.data, ...visibleBoards(identity.id) } }))) {
      return { ok: false };
    }
    for (const joined of socket.rooms) {
      if (joined.startsWith('board:') && joined !== room(id.data)) await socket.leave(joined);
    }
    socket.data.sessionDigest = identity.sessionDigest;
    await socket.join(room(id.data));
    return { ok: true };
  }

  private async forAuthorized(boardId: string, deliver: (socketId: string, sessionDigest: string) => void) {
    const roomId = room(boardId);
    try {
      const sockets = await this.server.in(roomId).fetchSockets();
      const digests = sockets.flatMap(({ data }) => data.sessionDigest ?? []);
      if (!digests.length) return;
      const sessions = await this.database.client.session.findMany({
        where: {
          digest: { in: digests }, expiresAt: { gt: new Date() },
          account: { OR: [{ boards: { some: { id: boardId } } }, { memberships: { some: { boardId } } }] },
        },
        select: { digest: true },
      });
      const active = new Set(sessions.map(({ digest }) => digest));
      for (const socket of sockets) {
        const sessionDigest = socket.data.sessionDigest;
        if (sessionDigest && active.has(sessionDigest)) deliver(socket.id, sessionDigest);
        else {
          this.server.to(socket.id).emit('board:refresh');
          await socket.leave(roomId);
        }
      }
    } catch {
      this.logger.warn('Could not deliver a board update.');
    }
  }

  publish(event: CardEvent, change: BoardChange, actor: Identity, socketId?: string) {
    return this.forAuthorized(change.boardId, (id, sessionDigest) => {
      if (id !== socketId || sessionDigest !== actor.sessionDigest) this.server.to(id).emit(event, change);
    });
  }

  refresh(boardId: string) {
    return this.forAuthorized(boardId, (id) => this.server.to(id).emit('board:refresh'));
  }

  disconnect(sessionDigest: string) {
    for (const socket of this.server.sockets.sockets.values()) {
      if (socket.data.sessionDigest === sessionDigest) socket.disconnect(true);
    }
  }
}
