import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createCardSchema, idSchema, moveCardSchema, updateCardSchema, versionSchema,
  type BoardChange, type CardEvent,
} from '@board/shared';
import { z } from 'zod';
import { CardsService } from './cards.service';
import { BoardGateway } from './board.gateway';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException({ message: 'Invalid request', issues: result.error.issues });
  return result.data;
}

@Controller()
export class BoardController {
  constructor(private readonly cards: CardsService, private readonly gateway: BoardGateway) {}

  @Get('boards/:id')
  board(@Param('id') id: string) {
    return this.cards.board(parse(idSchema, id));
  }

  private async announce(event: CardEvent, operation: Promise<BoardChange | null>, socketId?: string) {
    const change = await operation;
    if (change) this.gateway.publish(event, change, socketId);
    return { change };
  }

  @Post('cards')
  create(@Body() body: unknown, @Headers('x-socket-id') socketId?: string) {
    return this.announce('card:created', this.cards.create(parse(createCardSchema, body)), socketId);
  }

  @Patch('cards/:id')
  update(@Param('id') id: string, @Body() body: unknown, @Headers('x-socket-id') socketId?: string) {
    return this.announce('card:updated', this.cards.update(parse(idSchema, id), parse(updateCardSchema, body)), socketId);
  }

  @Patch('cards/:id/move')
  move(@Param('id') id: string, @Body() body: unknown, @Headers('x-socket-id') socketId?: string) {
    return this.announce('card:moved', this.cards.move(parse(idSchema, id), parse(moveCardSchema, body)), socketId);
  }

  @Delete('cards/:id')
  delete(@Param('id') id: string, @Query('expectedVersion') version: unknown, @Headers('x-socket-id') socketId?: string) {
    const expectedVersion = parse(z.string().regex(/^\d+$/).transform(Number).pipe(versionSchema), version);
    return this.announce('card:deleted', this.cards.delete(parse(idSchema, id), expectedVersion), socketId);
  }
}
