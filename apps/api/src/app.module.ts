import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthService, EmailDelivery, SessionGuard } from './auth';
import { BoardController } from './board.controller';
import { BoardGateway } from './board.gateway';
import { CardsService } from './cards.service';
import { ColumnsService } from './columns.service';
import { Database } from './database';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  controllers: [BoardController, WorkspaceController],
  providers: [BoardGateway, CardsService, ColumnsService, Database, AuthService, EmailDelivery, WorkspaceService,
    { provide: APP_GUARD, useClass: SessionGuard }],
})
export class AppModule {}
