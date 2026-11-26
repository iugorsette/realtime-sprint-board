import { Module } from '@nestjs/common';
import { BoardController } from './board.controller';
import { BoardGateway } from './board.gateway';
import { CardsService } from './cards.service';
import { Database } from './database';

@Module({
  controllers: [BoardController],
  providers: [BoardGateway, CardsService, Database],
})
export class AppModule {}
