import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { browserOrigin } from './auth';

async function main() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (process.env.NODE_ENV === 'production' && !browserOrigin().startsWith('https://')) {
    throw new Error('Set APP_ORIGIN to the public HTTPS origin in production.');
  }
  const trustedProxies = process.env.TRUSTED_PROXIES?.split(',').map((proxy) => proxy.trim()).filter(Boolean);
  if (trustedProxies?.length) app.set('trust proxy', trustedProxies);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_PORT ?? 3000), '127.0.0.1');
}

void main();
