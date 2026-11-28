import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { browserOrigin, EmailDelivery } from '../src/auth';
import { Database } from '../src/database';

const domain = randomUUID() + '.example.test';
const ownerEmail = 'owner@' + domain;
const guestEmail = 'guest@' + domain;
const strangerEmail = 'stranger@' + domain;
const codes = new Map<string, string>();
let app: INestApplication;
let url: string;
let database: Database['client'];
let mail: jest.SpiedFunction<EmailDelivery['sendCode']>;
let ownerCookie: string;
let guestCookie: string;
const originalSecret = process.env.AUTH_CODE_SECRET;

function call(path: string, method = 'GET', payload?: object, cookie = '', origin = browserOrigin()) {
  return fetch(url + path, { method, headers: { origin, cookie, 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined });
}

async function logIn(email: string) {
  expect((await call('/auth/code', 'POST', { email })).status).toBe(204);
  const code = codes.get(email.toLowerCase());
  expect(code).toMatch(/^\d{6}$/u);
  const response = await call('/auth/verify', 'POST', { email, code });
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie')!;
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('SameSite=Strict');
  expect(response.headers.get('cache-control')).toBe('no-store');
  return cookie.split(';')[0];
}

beforeAll(async () => {
  process.env.AUTH_CODE_SECRET = randomBytes(32).toString('hex');
  mail = jest.spyOn(EmailDelivery.prototype, 'sendCode').mockImplementation(async (email, code) => { codes.set(email, code); });
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
  database = app.get(Database).client;
});

afterAll(async () => {
  try {
    const accounts = await database?.account.findMany({ where: { email: { endsWith: domain } }, select: { id: true } }) ?? [];
    await database?.board.deleteMany({ where: { ownerId: { in: accounts.map(({ id }) => id) } } });
    await database?.account.deleteMany({ where: { email: { endsWith: domain } } });
    await database?.loginCode.deleteMany({ where: { email: { endsWith: domain } } });
  } finally {
    mail?.mockRestore();
    if (originalSecret === undefined) delete process.env.AUTH_CODE_SECRET;
    else process.env.AUTH_CODE_SECRET = originalSecret;
    await app?.close();
  }
});

it('normalizes email, rate-limits resends, consumes codes once and revokes sessions at sign-out', async () => {
  expect((await call('/auth/code', 'POST', { email: ownerEmail }, '', 'https://another.example')).status).toBe(403);
  ownerCookie = await logIn(ownerEmail.toUpperCase());
  expect((await call('/auth/code', 'POST', { email: ownerEmail })).status).toBe(429);
  const oldCode = codes.get(ownerEmail);
  expect((await call('/auth/verify', 'POST', { email: ownerEmail, code: oldCode })).status).toBe(401);
  const profile = await call('/me', 'GET', undefined, ownerCookie);
  expect(await profile.json()).toMatchObject({ email: ownerEmail, name: '' });

  const strangerCookie = await logIn(strangerEmail);
  expect((await call('/auth/logout', 'POST', undefined, strangerCookie)).status).toBe(204);
  expect((await call('/me', 'GET', undefined, strangerCookie)).status).toBe(401);
});

it('locks a code after repeated mistakes', async () => {
  const email = 'mistakes@' + domain;
  expect((await call('/auth/code', 'POST', { email })).status).toBe(204);
  const code = codes.get(email)!;
  const wrong = code === '000000' ? '000001' : '000000';
  for (let index = 0; index < 5; index += 1) {
    expect((await call('/auth/verify', 'POST', { email, code: wrong })).status).toBe(401);
  }
  expect((await call('/auth/verify', 'POST', { email, code })).status).toBe(401);
  expect(await database.account.count({ where: { email } })).toBe(0);
});

it('rejects expired codes and expired sessions', async () => {
  const email = 'expiry@' + domain;
  expect((await call('/auth/code', 'POST', { email })).status).toBe(204);
  await database.loginCode.update({ where: { email }, data: { expiresAt: new Date(0) } });
  expect((await call('/auth/verify', 'POST', { email, code: codes.get(email) })).status).toBe(401);
  const sessionEmail = 'expired-session@' + domain;
  const cookie = await logIn(sessionEmail);
  await database.session.updateMany({ where: { account: { email: sessionEmail } }, data: { expiresAt: new Date(0) } });
  expect((await call('/me', 'GET', undefined, cookie)).status).toBe(401);
});

it('supports profile edits, role-bound invitations and the ownership limit under concurrent requests', async () => {
  const avatar = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jEAkAAAAASUVORK5CYII=';
  const profile = await call('/me', 'PATCH', { name: 'Board owner', avatar }, ownerCookie);
  expect(profile.status).toBe(200);
  expect((await call('/me', 'PATCH', { name: 'Board owner', avatar: Buffer.from('<svg onload=alert(1)>').toString('base64') },
    ownerCookie)).status).toBe(400);
  const responses = await Promise.all(Array.from({ length: 6 }, (_, index) => call('/boards', 'POST', { name: 'Private board ' + index }, ownerCookie)));
  expect(responses.filter(({ status }) => status === 201)).toHaveLength(5);
  expect(responses.filter(({ status }) => status === 400)).toHaveLength(1);
  const result = await responses.find(({ status }) => status === 201)!.json() as { id: string };
  const path = '/boards/' + result.id;
  guestCookie = await logIn(guestEmail);
  expect((await call(path, 'GET', undefined, guestCookie)).status).toBe(404);
  expect((await call(path + '/invites', 'POST', { email: guestEmail, role: 'VIEWER' }, ownerCookie)).status).toBe(204);
  expect((await call(path + '/accept-invite', 'POST', undefined, ownerCookie)).status).toBe(404);
  const workspace = await call('/workspace', 'GET', undefined, guestCookie);
  expect(await workspace.json()).toMatchObject({ boards: [], invitations: [{ id: result.id, role: 'VIEWER' }] });
  expect((await call(path + '/accept-invite', 'POST', undefined, guestCookie)).status).toBe(204);
  expect((await call('/me', 'PATCH', { name: 'Board guest', avatar }, guestCookie)).status).toBe(200);
  const board = await call(path, 'GET', undefined, guestCookie);
  expect(board.status).toBe(200);
  const people = [{ id: expect.any(String), name: 'Board owner', initials: 'BO', avatar },
    { id: expect.any(String), name: 'Board guest', initials: 'BG', avatar }];
  expect((await board.json()).assignees).toEqual(expect.arrayContaining(people));
  expect((await call(path + '/members', 'GET', undefined, guestCookie)).status).toBe(403);
  const guest = await database.account.findUniqueOrThrow({ where: { email: guestEmail } });
  expect((await call(path + '/members/' + guest.id, 'DELETE', undefined, guestCookie)).status).toBe(204);
  expect((await call(path, 'GET', undefined, guestCookie)).status).toBe(404);
  expect((await (await call(path, 'GET', undefined, ownerCookie)).json()).assignees).toEqual(expect.arrayContaining([
    people[0], { id: expect.any(String), name: 'Board guest', initials: 'BG' },
  ]));
});

it('lets an owner rename and delete a board while preserving access boundaries', async () => {
  const host = await logIn('manage-host@' + domain);
  const editorEmail = 'manage-editor@' + domain;
  const editor = await logIn(editorEmail);
  const created = await call('/boards', 'POST', { name: 'Original board' }, host);
  expect(created.status).toBe(201);
  const { id } = await created.json() as { id: string };
  const path = '/boards/' + id;
  const snapshot = await (await call(path, 'GET', undefined, host)).json() as { columns: { id: string }[] };
  const cardCreation = await call(path + '/cards', 'POST', {
    columnId: snapshot.columns[0].id, title: 'Card in managed board', description: '', priority: 'MEDIUM', assigneeIds: [], tags: [],
  }, host);
  expect(cardCreation.status).toBe(201);
  const { change } = await cardCreation.json() as { change: { cards: { id: string }[] } };
  const link = '/card-links/' + change.cards[0].id;
  expect((await call(path + '/invites', 'POST', { email: editorEmail, role: 'EDITOR' }, host)).status).toBe(204);
  expect((await call(path + '/accept-invite', 'POST', undefined, editor)).status).toBe(204);

  expect((await call(path, 'PATCH', { name: 'Unavailable', expectedName: 'Original board' }, editor)).status).toBe(403);
  expect((await call(path, 'DELETE', { expectedName: 'Original board' }, editor)).status).toBe(403);
  expect((await call(path, 'PATCH', { name: 'Renamed board', expectedName: 'Original board' }, host)).status).toBe(204);
  expect((await call(path, 'DELETE', { expectedName: 'Original board' }, host)).status).toBe(409);
  expect(await (await call(link, 'GET', undefined, editor)).json()).toEqual({ boardId: id });
  expect(await (await call(path, 'GET', undefined, editor)).json()).toMatchObject({ id, name: 'Renamed board', revision: 2 });

  expect((await call(path, 'DELETE', { expectedName: 'Renamed board' }, host)).status).toBe(204);
  expect((await call(path, 'GET', undefined, editor)).status).toBe(404);
  expect((await call(link, 'GET', undefined, host)).status).toBe(404);
  expect(await (await call('/workspace', 'GET', undefined, editor)).json()).toMatchObject({ boards: [] });
});

it('enforces the shared-board limit across concurrent invitation accepts', async () => {
  const hosts = Array.from({ length: 11 }, () => randomUUID());
  await database.account.createMany({ data: hosts.map((id) => ({ id, email: id + '@' + domain })) });
  const boards = await Promise.all(hosts.map((ownerId) => database.board.create({
    data: { id: randomUUID(), name: 'Shared board', ownerId, invites: {
      create: { email: guestEmail, expiresAt: new Date(Date.now() + 600_000), role: 'EDITOR' },
    } },
  })));
  const results = await Promise.all(boards.map(({ id }) => call('/boards/' + id + '/accept-invite', 'POST', undefined, guestCookie)));
  expect(results.filter(({ status }) => status === 204)).toHaveLength(10);
  expect(results.filter(({ status }) => status === 400)).toHaveLength(1);
  const workspace = await call('/workspace', 'GET', undefined, guestCookie);
  expect((await workspace.json() as { boards: unknown[] }).boards).toHaveLength(10);
});
