import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import {
  type Board, type BoardChange, type Card, type ClientToServerEvents, type ServerToClientEvents,
} from '@board/shared';
import { AppModule } from '../src/app.module';
import { Database } from '../src/database';
import { browserOrigin, cookieDigest } from '../src/auth';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const boardId = randomUUID();
const isolatedBoardId = randomUUID();
const first = randomUUID();
const second = randomUUID();
const actor = randomUUID();
const collaborator = randomUUID();
const externalActor = randomUUID();
const owner = randomUUID();
const outsider = randomUUID();
const viewer = randomUUID();
const ownerCookie = 'sprint_board_session=' + randomBytes(32).toString('base64url');
const outsiderCookie = 'sprint_board_session=' + randomBytes(32).toString('base64url');
const viewerCookie = 'sprint_board_session=' + randomBytes(32).toString('base64url');
const cards = '/boards/' + boardId + '/cards';
const columns = '/boards/' + boardId + '/columns';
const fields = { title: 'Test card', description: '', priority: 'MEDIUM', tags: ['testing'], assigneeIds: [] };
let app: INestApplication;
let url: string;
let db: Database['client'];

function request(path: string, method = 'GET', body?: object, socketId?: string, cookie = ownerCookie) {
  return fetch(url + path, {
    method,
    headers: { 'content-type': 'application/json', origin: browserOrigin(), cookie, ...(socketId ? { 'x-socket-id': socketId } : {}) },
    body: body && JSON.stringify(body),
  });
}

async function snapshot(): Promise<Board> {
  return (await request(`/boards/${boardId}`)).json();
}

async function create(columnId = first) {
  const response = await request(cards, 'POST', { ...fields, columnId });
  expect(response.status).toBe(201);
  const { change } = await response.json() as { change: BoardChange };
  return change.cards.at(-1)!;
}

function move(card: Card, targetColumnId: string, beforeCardId: string | null) {
  return request(`${cards}/${card.id}/move`, 'PATCH', { expectedVersion: card.version, targetColumnId, beforeCardId });
}

async function connect(id: string, cookie = ownerCookie, allowed = true): Promise<Client> {
  const socket: Client = io(url, { autoConnect: false, transports: ['websocket'], reconnection: false, extraHeaders: { cookie, origin: browserOrigin() } });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    const result = await socket.timeout(1000).emitWithAck('board:join', id);
    expect(result).toEqual({ ok: allowed });
    return socket;
  } catch (error) {
    socket.disconnect();
    throw error;
  }
}

beforeAll(async () => {
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
  db = app.get(Database).client;
  await db.account.createMany({ data: [owner, outsider, viewer].map((id) => ({ id, email: id + '@example.test' })) });
  await db.session.createMany({ data: [owner, outsider, viewer].map((accountId, index) => ({
    accountId, digest: cookieDigest([ownerCookie, outsiderCookie, viewerCookie][index])!,
    expiresAt: new Date(Date.now() + 600_000),
  })) });
  await db.board.create({
    data: {
      id: boardId, name: 'Tests', ownerId: owner, members: { create: { accountId: viewer, role: 'VIEWER' } }, columns: { create: [
        { id: first, name: 'First', position: 0 }, { id: second, name: 'Second', position: 1 },
      ] },
      assignees: { create: [
        { id: actor, name: 'Test User', initials: 'TU' },
        { id: collaborator, name: 'Collaborator', initials: 'CO' },
      ] },
    },
  });
  await db.board.create({ data: {
    id: isolatedBoardId, name: 'Separate board', ownerId: owner,
    assignees: { create: { id: externalActor, name: 'Another user', initials: 'AU' } },
  } });
});

afterAll(async () => {
  try {
    await db?.board.deleteMany({ where: { id: { in: [boardId, isolatedBoardId] } } });
    await db?.account.deleteMany({ where: { id: { in: [owner, outsider, viewer] } } });
  } finally {
    await app?.close();
  }
});

beforeEach(async () => {
  await db.card.deleteMany({ where: { columnId: { in: [first, second] } } });
  await db.column.deleteMany({ where: { boardId, id: { notIn: [first, second] } } });
  await db.board.update({ where: { id: boardId }, data: { revision: 0 } });
});

it('appends and renames columns by ID, refreshes collaborators, and deletes empty columns', async () => {
  const subscriber = await connect(boardId, viewerCookie);
  try {
    const refreshed = new Promise<void>((resolve) => subscriber.once('board:refresh', resolve));
    expect((await request(columns, 'POST', { name: '  Testing  ' })).status).toBe(204);
    await refreshed;
    const created = (await snapshot()).columns.at(-1)!;
    expect(created).toMatchObject({ name: 'Testing', position: 2, cards: [] });
    expect((await request(columns, 'POST', { name: 'Testing' })).status).toBe(409);
    const path = `${columns}/${created.id}`;
    expect((await request(path, 'PATCH', { name: 'Verification', expectedName: 'Testing' })).status).toBe(204);
    expect((await request(path, 'DELETE', { expectedName: 'Testing' })).status).toBe(409);
    expect(await snapshot()).toMatchObject({ revision: 2, columns: [{ id: first }, { id: second }, { id: created.id, name: 'Verification' }] });
    expect((await request(path, 'DELETE', { expectedName: 'Verification' })).status).toBe(204);
    expect(await snapshot()).toMatchObject({ revision: 3, columns: [{ id: first }, { id: second }] });
  } finally {
    subscriber.disconnect();
  }
});

it('restricts column writes to the owner and preserves cards when deletion races with creation', async () => {
  expect((await request(columns, 'POST', { name: 'Forbidden' }, undefined, viewerCookie)).status).toBe(403);
  expect((await request(columns, 'POST', { name: 'Hidden' }, undefined, outsiderCookie)).status).toBe(404);
  expect((await request(columns, 'POST', { name: ' ' })).status).toBe(400);
  try {
    const [creation, deletion] = await Promise.all([
      request(cards, 'POST', { ...fields, columnId: first }),
      request(`${columns}/${first}`, 'DELETE', { expectedName: 'First' }),
    ]);
    if (creation.status === 201) {
      expect(deletion.status).toBe(409);
      expect((await snapshot()).columns[0].cards).toHaveLength(1);
    } else {
      expect(creation.status).toBe(404);
      expect(deletion.status).toBe(204);
      expect((await request(`${columns}/${second}`, 'DELETE', { expectedName: 'Second' })).status).toBe(409);
    }
  } finally {
    await db.column.upsert({ where: { id: first }, update: {}, create: { id: first, boardId, name: 'First', position: 0 } });
  }
});

it('persists CRUD with incrementing revisions and a board snapshot', async () => {
  const card = await create();
  const edited = await request(`${cards}/${card.id}`, 'PATCH', { ...fields, expectedVersion: card.version, assigneeIds: [actor] });
  expect(edited.status).toBe(200);
  const { change } = await edited.json() as { change: BoardChange };
  expect(change.cards[0]).toMatchObject({ id: card.id, version: 2, assigneeIds: [actor] });
  expect(await snapshot()).toMatchObject({ revision: 2, columns: [{ cards: change.cards }, { cards: [] }] });

  const removed = await request(`${cards}/${card.id}?expectedVersion=2`, 'DELETE');
  expect(await removed.json()).toEqual({ change: { boardId, revision: 3, cards: [], deletedCardIds: [card.id] } });
  expect(await snapshot()).toMatchObject({ revision: 3, columns: [{ cards: [] }, { cards: [] }] });
  const deleted = await move(card, second, null);
  expect(deleted.status).toBe(409);
  expect(await deleted.json()).toEqual({ code: 'CARD_VERSION_CONFLICT', card: null });
});

it('saves, moves, and clears multiple assignees without duplicate assignments', async () => {
  const created = await request(cards, 'POST', {
    ...fields, columnId: first, assigneeIds: [collaborator, actor, collaborator],
  });
  expect(created.status).toBe(201);
  const { change } = await created.json() as { change: BoardChange };
  const assigned = change.cards[0];
  const ids = [actor, collaborator].sort();
  expect(assigned.assigneeIds).toEqual(ids);

  const moved = await move(assigned, second, null);
  expect(moved.status).toBe(200);
  const movedChange = await moved.json() as { change: BoardChange };
  expect(movedChange.change.cards[0]).toMatchObject({ assigneeIds: ids, version: 2 });

  const cleared = await request(`${cards}/${assigned.id}`, 'PATCH', { ...fields, expectedVersion: 2 });
  expect(cleared.status).toBe(200);
  const clearedChange = await cleared.json() as { change: BoardChange };
  expect(clearedChange.change.cards[0]).toMatchObject({ assigneeIds: [], version: 3 });
  expect((await snapshot()).columns[1].cards[0].assigneeIds).toEqual([]);
});

it('replays a client-generated creation ID without duplicating or resurrecting the card', async () => {
  const id = randomUUID();
  const body = { ...fields, id, columnId: first };
  const invalid = await request(cards, 'POST', { ...body, assigneeIds: [externalActor] });
  expect(invalid.status).toBe(400);

  const responses = await Promise.all([request(cards, 'POST', body), request(cards, 'POST', body)]);
  expect(responses.map(({ status }) => status)).toEqual([201, 201]);
  const results = await Promise.all(responses.map((response) => response.json() as Promise<{ change: BoardChange | null }>));
  expect(results.filter(({ change }) => change)).toHaveLength(1);
  expect(await snapshot()).toMatchObject({ revision: 1, columns: [{ cards: [{ id }] }, { cards: [] }] });

  expect((await request(`${cards}/${id}?expectedVersion=1`, 'DELETE')).status).toBe(200);
  expect(await (await request(cards, 'POST', body)).json()).toEqual({ change: null });
  expect(await snapshot()).toMatchObject({ revision: 2, columns: [{ cards: [] }, { cards: [] }] });
});

it('accepts only one concurrent write against a version', async () => {
  const card = await create();
  const responses = await Promise.all([
    move(card, second, null),
    request(`${cards}/${card.id}`, 'PATCH', { ...fields, title: 'Concurrent edit', expectedVersion: card.version }),
  ]);
  expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
  const accepted = await responses.find(({ ok }) => ok)!.json() as { change: BoardChange };
  const rejected = await responses.find(({ status }) => status === 409)!.json();
  expect(rejected).toEqual({ code: 'CARD_VERSION_CONFLICT', card: accepted.change.cards[0] });
  expect((await snapshot()).revision).toBe(2);
});

it('moves against current neighbors and reports all rebalance changes', async () => {
  const moving = await create();
  const a = await create(second);
  const b = await create(second);
  await db.card.update({ where: { id: b.id }, data: { position: a.position + 0.00000001 } });
  const response = await move(moving, second, b.id);

  expect(response.status).toBe(200);
  const { change } = await response.json() as { change: BoardChange };
  expect(change.cards).toMatchObject([
    { id: moving.id, columnId: second, position: 2048, version: 2 },
    { id: b.id, columnId: second, position: 3072, version: 2 },
  ]);
  const board = await snapshot();
  expect(board.columns[1].cards.map(({ id }) => id)).toEqual([a.id, moving.id, b.id]);

  const unchanged = await move(change.cards[0], second, b.id);
  expect(await unchanged.json()).toEqual({ change: null });
  expect((await snapshot()).revision).toBe(change.revision);
  const staleAnchor = await move(change.cards[0], second, 'missing-anchor');
  expect(staleAnchor.status).toBe(409);
  expect(await staleAnchor.json()).toMatchObject({ code: 'BOARD_ORDER_CHANGED', card: change.cards[0] });
});

it('validates input and rejects unknown resources and unrelated assignees', async () => {
  expect((await request('/boards/unknown')).status).toBe(404);
  expect((await request(cards, 'POST', { ...fields, columnId: 'missing' })).status).toBe(404);
  expect((await request(cards, 'POST', { ...fields, columnId: first, assigneeIds: [actor, externalActor] })).status).toBe(400);
  const card = await create();
  expect((await move(card, 'missing', null)).status).toBe(404);
  expect((await move(card, first, card.id)).status).toBe(400);
  expect((await request(`${cards}/${card.id}`, 'DELETE')).status).toBe(400);
});

it('broadcasts only committed changes to the room and excludes the sender', async () => {
  const origin = await connect(boardId);
  const peer = await connect(boardId);
  const isolated = await connect(isolatedBoardId);
  try {
    const originEvents: BoardChange[] = [];
    const isolatedEvents: BoardChange[] = [];
    origin.on('card:created', (change) => originEvents.push(change));
    isolated.on('card:created', (change) => isolatedEvents.push(change));

    const event = new Promise<BoardChange>((resolve) => peer.once('card:created', resolve));
    const response = await request(cards, 'POST', { ...fields, columnId: first }, origin.id);
    expect(response.status).toBe(201);
    const { change } = await response.json() as { change: BoardChange };
    expect(await event).toEqual(change);
    expect((await snapshot()).revision).toBe(change.revision);

    const originBarrier = new Promise<BoardChange>((resolve) => origin.once('card:updated', resolve));
    const updated = await request(`${cards}/${change.cards[0].id}`, 'PATCH', { ...fields, expectedVersion: 1 });
    expect(updated.status).toBe(200);
    await originBarrier;
    expect(originEvents).toEqual([]);
    expect(isolatedEvents).toEqual([]);
    expect(await peer.timeout(1000).emitWithAck('board:join', 'missing-id')).toEqual({ ok: false });
  } finally {
    origin.disconnect();
    peer.disconnect();
    isolated.disconnect();
  }
});

it('requires an active session and board membership for reads, writes, links and socket rooms', async () => {
  const card = await create();
  expect((await request('/boards/' + boardId, 'GET', undefined, undefined, '')).status).toBe(401);
  expect((await request('/boards/' + boardId, 'GET', undefined, undefined, outsiderCookie)).status).toBe(404);
  expect((await request('/card-links/' + card.id, 'GET', undefined, undefined, outsiderCookie)).status).toBe(404);
  expect((await request('/card-links/' + card.id, 'GET', undefined, undefined, viewerCookie)).status).toBe(200);
  expect((await request(cards + '/' + card.id, 'PATCH', { ...fields, expectedVersion: 0 }, undefined, outsiderCookie)).status).toBe(400);
  const denied = await request(cards + '/' + card.id, 'PATCH', { ...fields, expectedVersion: 1 }, undefined, outsiderCookie);
  expect(denied.status).toBe(404);
  expect(await denied.text()).not.toContain(card.title);
  expect((await request(cards, 'POST', { ...fields, columnId: first }, undefined, viewerCookie)).status).toBe(403);
  const socket = await connect(boardId, outsiderCookie, false);
  socket.disconnect();
});

it('removes a revoked socket from board updates and keeps its cards private', async () => {
  const socket = await connect(boardId, viewerCookie);
  try {
    let received = false;
    socket.on('card:created', () => { received = true; });
    const refresh = new Promise<void>((resolve) => socket.once('board:refresh', resolve));
    const removal = await request('/boards/' + boardId + '/members/' + viewer, 'DELETE');
    expect(removal.status).toBe(204);
    await refresh;
    await create();
    expect(received).toBe(false);
    expect((await request('/boards/' + boardId, 'GET', undefined, undefined, viewerCookie)).status).toBe(404);
  } finally {
    socket.disconnect();
    await db.boardMember.upsert({ where: { boardId_accountId: { boardId, accountId: viewer } },
      create: { boardId, accountId: viewer, role: 'VIEWER' }, update: {} });
  }
});
