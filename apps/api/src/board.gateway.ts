import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { idSchema, type BoardChange, type CardEvent, type ClientToServerEvents, type ServerToClientEvents } from '@board/shared';
import type { Server, Socket } from 'socket.io';
import { CardsService } from './cards.service';

type BoardSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
const room = (boardId: string) => `board:${boardId}`;

@WebSocketGateway()
export class BoardGateway {
  @WebSocketServer()
  private readonly server!: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(private readonly cards: CardsService) {}

  @SubscribeMessage('board:join')
  async join(@ConnectedSocket() socket: BoardSocket, @MessageBody() value: unknown) {
    const id = idSchema.safeParse(value);
    if (!id.success || !(await this.cards.exists(id.data))) return { ok: false };
    for (const joined of socket.rooms) {
      if (joined.startsWith('board:') && joined !== room(id.data)) await socket.leave(joined);
    }
    await socket.join(room(id.data));
    return { ok: true };
  }

  publish(event: CardEvent, change: BoardChange, socketId?: string) {
    const destination = room(change.boardId);
    const recipient = this.server.to(destination);
    const origin = socketId && this.server.sockets.sockets.get(socketId);
    if (origin && origin.rooms.has(destination)) {
      recipient.except(origin.id).emit(event, change);
    } else {
      recipient.emit(event, change);
    }
  }
}
