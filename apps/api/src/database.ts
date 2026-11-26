import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient } from './generated/prisma/client';

export function createDatabase() {
  config({ path: '../../.env', quiet: true });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required. Copy .env.example to .env.');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

@Injectable()
export class Database implements OnModuleDestroy {
  readonly client = createDatabase();

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
