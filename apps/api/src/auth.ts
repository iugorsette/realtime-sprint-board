import {
  CanActivate, createParamDecorator, ExecutionContext, HttpException, Injectable, ServiceUnavailableException,
  SetMetadata, UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createTransport } from 'nodemailer';
import { DEMO_BOARD_ID, type Account } from '@board/shared';
import { Database } from './database';

const cookieName = 'sprint_board_session';
const minute = 60_000;
const codeLifetime = 10 * minute;
const sessionLifetime = 12 * 60 * minute;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const browserOrigin = () => new URL(process.env.APP_ORIGIN ?? 'http://localhost:5173').origin;
export type Identity = { id: string; email: string; sessionDigest: string };
type HttpRequest = IncomingMessage & { identity: Identity; ip?: string };

export const Public = () => SetMetadata('public', true);
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  context.switchToHttp().getRequest<HttpRequest>().identity);
export const ClientIp = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<HttpRequest>();
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
});

export function sessionCookie(value = '', maxAge = 0) {
  const secure = browserOrigin().startsWith('https:') ? '; Secure' : '';
  return `${cookieName}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure}`;
}

export function cookieDigest(header: string | undefined) {
  const token = header?.match(/(?:^|;\s*)sprint_board_session=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
  return token ? digest(token) : undefined;
}

export function publicAccount(account: { id: string; email: string; name: string; avatar: Uint8Array | null }): Account {
  return { id: account.id, email: account.email, name: account.name,
    avatar: account.avatar ? Buffer.from(account.avatar).toString('base64') : null };
}

@Injectable()
export class EmailDelivery {
  async sendCode(email: string, code: string) {
    const { SMTP_URL, SMTP_FROM } = process.env;
    if (!SMTP_URL || !SMTP_FROM) throw new ServiceUnavailableException('Email delivery is unavailable.');
    const url = new URL(SMTP_URL);
    if (url.protocol !== 'smtps:' && url.protocol !== 'smtp:') throw new Error('Invalid SMTP protocol');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && process.env.NODE_ENV !== 'production';
    const transport = createTransport({ url: url.href, requireTLS: !local && url.protocol === 'smtp:',
      connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 8000 });
    await transport.sendMail({ from: SMTP_FROM, to: email, subject: 'Your Sprint Board sign-in code',
      text: `Your code is ${code}. It expires in ten minutes. If you did not request this code, you can ignore this message.` });
  }
}

@Injectable()
export class AuthService {
  constructor(private readonly database: Database, private readonly emailDelivery: EmailDelivery) {}

  async identity(cookie: string | undefined): Promise<Identity | undefined> {
    const sessionDigest = cookieDigest(cookie);
    if (!sessionDigest) return;
    const record = await this.database.client.session.findUnique({ where: { digest: sessionDigest, expiresAt: { gt: new Date() } },
      select: { account: { select: { id: true, email: true } } } });
    return record && { ...record.account, sessionDigest } || undefined;
  }

  async signOut(identity: Identity) {
    await this.database.client.session.deleteMany({ where: { digest: identity.sessionDigest } });
  }

  private codeDigest(email: string, code: string) {
    const secret = process.env.AUTH_CODE_SECRET;
    if (!secret || secret.length < 32) throw new ServiceUnavailableException('Sign-in is unavailable.');
    return createHmac('sha256', secret).update(email).update('\0').update(code).digest('hex');
  }

  private async limit(key: string, maximum: number, window: number) {
    const now = new Date();
    const expires = new Date(+now + window);
    const [value] = await this.database.client.$queryRaw<{ attempts: number }[]>`
      INSERT INTO auth_limits (key, attempts, expires_at) VALUES (${digest(key)}, 1, ${expires})
      ON CONFLICT (key) DO UPDATE SET
        attempts = CASE WHEN auth_limits.expires_at <= ${now} THEN 1 ELSE LEAST(auth_limits.attempts, ${maximum}) + 1 END,
        expires_at = CASE WHEN auth_limits.expires_at <= ${now} THEN ${expires} ELSE auth_limits.expires_at END
      RETURNING attempts`;
    if (value.attempts > maximum) throw new HttpException('Too many attempts. Try again later.', 429);
  }

  async requestCode(email: string, ip: string) {
    await this.limit(`send-ip:${ip}`, 30, 60 * minute);
    await this.limit(`send-email:${email}`, 1, minute);
    const code = String(randomInt(0, 1000_000)).padStart(6, '0');
    const codeDigest = this.codeDigest(email, code);
    const now = new Date();
    const expiresAt = new Date(+now + codeLifetime);
    const db = this.database.client;
    await db.$transaction([
      db.authLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.loginCode.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.loginCode.upsert({ where: { email }, create: { email, digest: codeDigest, expiresAt },
        update: { digest: codeDigest, expiresAt, attempts: 0 } }),
    ]);
    try {
      await this.emailDelivery.sendCode(email, code);
    } catch {
      await db.loginCode.deleteMany({ where: { email, digest: codeDigest } });
      throw new ServiceUnavailableException('Email delivery is unavailable. Try again later.');
    }
  }

  async verifyCode(email: string, code: string, ip: string, previousSession?: string) {
    await this.limit(`verify-ip:${ip}`, 60, 15 * minute);
    await this.limit(`verify-email:${email}`, 10, 15 * minute);
    const submitted = Buffer.from(this.codeDigest(email, code), 'hex');
    const token = randomBytes(32).toString('base64url');
    const result = await this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT email FROM login_codes WHERE email = ${email} FOR UPDATE`;
      const stored = await tx.loginCode.findUnique({ where: { email } });
      if (!stored || stored.expiresAt <= new Date() || stored.attempts >= 5) return;
      if (!timingSafeEqual(Buffer.from(stored.digest, 'hex'), submitted)) {
        await tx.loginCode.update({ where: { email }, data: { attempts: { increment: 1 } } });
        return;
      }
      await tx.loginCode.delete({ where: { email } });
      const account = await tx.account.upsert({ where: { email }, create: { email }, update: {} });
      if (process.env.LEGACY_BOARD_OWNER_EMAIL?.trim().toLowerCase() === email) {
        await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${account.id} FOR UPDATE`;
        if (await tx.board.count({ where: { ownerId: account.id } }) < 5) {
          const { count } = await tx.board.updateMany({ where: { id: DEMO_BOARD_ID, ownerId: null }, data: { ownerId: account.id } });
          if (count) await tx.assignee.create({ data: { boardId: DEMO_BOARD_ID, accountId: account.id,
            name: account.name || 'Board owner', initials: initials(account.name) } });
        }
      }
      if (previousSession) await tx.session.deleteMany({ where: { digest: previousSession } });
      await tx.session.create({ data: { digest: digest(token), accountId: account.id, expiresAt: new Date(Date.now() + sessionLifetime) } });
      return publicAccount(account);
    });
    if (!result) throw new UnauthorizedException('The code is invalid or expired.');
    return { account: result, cookie: sessionCookie(token, sessionLifetime / 1000) };
  }
}

export function initials(name: string) {
  return name.split(/\s+/u).slice(0, 2).map((part) => Array.from(part)[0] ?? '').join('').toUpperCase() || '—';
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http') return true;
    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequest>();
    http.getResponse<ServerResponse>().setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.headers.origin !== browserOrigin()) {
      throw new ForbiddenException('Invalid request origin.');
    }
    if (this.reflector.get<boolean>('public', context.getHandler())) return true;
    const identity = await this.auth.identity(request.headers.cookie);
    if (!identity) throw new UnauthorizedException('Sign in to continue.');
    request.identity = identity;
    return true;
  }
}
