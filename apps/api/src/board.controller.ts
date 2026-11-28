import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createCardSchema, createColumnSchema, deleteColumnSchema, idSchema, moveCardSchema, updateColumnSchema, updateCardSchema, versionSchema,
  type BoardChange, type CardEvent,
} from '@board/shared';
import { z } from 'zod';
import { CardsService } from './cards.service';
import { ColumnsService } from './columns.service';
import { BoardGateway } from './board.gateway';
import { CurrentUser, type Identity } from './auth';

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException({ message: 'Invalid request', issues: result.error.issues });
  return result.data;
}

@Controller('boards/:boardId')
export class BoardController {
  constructor(private readonly cards: CardsService, private readonly columns: ColumnsService, private readonly gateway: BoardGateway) {}

  @Get()
  board(@Param('boardId') id: string, @CurrentUser() user: Identity) {
    return this.cards.board(parse(idSchema, id), user.id);
  }

  @Post('columns')
  @HttpCode(204)
  async createColumn(@Param('boardId') boardId: string, @CurrentUser() user: Identity, @Body() body: unknown) {
    const id = parse(idSchema, boardId);
    await this.columns.create(id, user.id, parse(createColumnSchema, body));
    await this.gateway.refresh(id);
  }

  @Patch('columns/:id')
  @HttpCode(204)
  async updateColumn(@Param('boardId') boardId: string, @Param('id') columnId: string, @CurrentUser() user: Identity, @Body() body: unknown) {
    const id = parse(idSchema, boardId);
    await this.columns.update(id, user.id, parse(idSchema, columnId), parse(updateColumnSchema, body));
    await this.gateway.refresh(id);
  }

  @Delete('columns/:id')
  @HttpCode(204)
  async deleteColumn(@Param('boardId') boardId: string, @Param('id') columnId: string, @CurrentUser() user: Identity,
    @Body() body: unknown) {
    const id = parse(idSchema, boardId);
    await this.columns.delete(id, user.id, parse(idSchema, columnId), parse(deleteColumnSchema, body).expectedName);
    await this.gateway.refresh(id);
  }

  private async announce(event: CardEvent, operation: Promise<BoardChange | null>, user: Identity, socketId?: string) {
    const change = await operation;
    if (change) await this.gateway.publish(event, change, user, socketId);
    return { change };
  }

  @Post('cards')
  create(@Param('boardId') board: string, @CurrentUser() user: Identity, @Body() body: unknown, @Headers('x-socket-id') socketId?: string) {
    return this.announce('card:created', this.cards.create(parse(idSchema, board), user.id, parse(createCardSchema, body)), user, socketId);
  }

  @Patch('cards/:id')
  update(@Param('boardId') board: string, @CurrentUser() user: Identity, @Param('id') id: string, @Body() body: unknown,
    @Headers('x-socket-id') socketId?: string) {
    return this.announce('card:updated', this.cards.update(parse(idSchema, board), user.id, parse(idSchema, id), parse(updateCardSchema, body)), user, socketId);
  }

  @Patch('cards/:id/move')
  move(@Param('boardId') board: string, @CurrentUser() user: Identity, @Param('id') id: string, @Body() body: unknown,
    @Headers('x-socket-id') socketId?: string) {
    return this.announce('card:moved', this.cards.move(parse(idSchema, board), user.id, parse(idSchema, id), parse(moveCardSchema, body)), user, socketId);
  }

  @Delete('cards/:id')
  delete(@Param('boardId') board: string, @CurrentUser() user: Identity, @Param('id') id: string,
    @Query('expectedVersion') version: unknown, @Headers('x-socket-id') socketId?: string) {
    const expectedVersion = parse(z.string().regex(/^\d+$/).transform(Number).pipe(versionSchema), version);
    return this.announce('card:deleted', this.cards.delete(parse(idSchema, board), user.id, parse(idSchema, id), expectedVersion), user, socketId);
  }
}
