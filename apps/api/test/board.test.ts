import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import {
  type Board, type BoardChange, type Card, type ClientToServerEvents, type ServerToClientEvents,
} from '@board/shared';
import { AppModule } from '../src/app.module';
import { Database } from '../src/database';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const boardId = randomUUID();
const isolatedBoardId = randomUUID();
const first = randomUUID();
const second = randomUUID();
const actor = randomUUID();
const collaborator = randomUUID();
const externalActor = randomUUID();
const fields = { title: 'Test card', description: '', priority: 'MEDIUM', tags: ['testing'], assigneeIds: [] };
let app: INestApplication;
let url: string;
let db: Database['client'];

function request(path: string, method = 'GET', body?: object, socketId?: string) {
  return fetch(url + path, {
    method,
    headers: { 'content-type': 'application/json', ...(socketId ? { 'x-socket-id': socketId } : {}) },
    body: body && JSON.stringify(body),
  });
}

async function snapshot(): Promise<Board> {
  return (await request(`/boards/${boardId}`)).json();
}

async function create(columnId = first) {
  const response = await request('/cards', 'POST', { ...fields, columnId });
  expect(response.status).toBe(201);
  const { change } = await response.json() as { change: BoardChange };
  return change.cards.at(-1)!;
}

function move(card: Card, targetColumnId: string, beforeCardId: string | null) {
  return request(`/cards/${card.id}/move`, 'PATCH', { expectedVersion: card.version, targetColumnId, beforeCardId });
}

async function connect(id: string): Promise<Client> {
  const socket: Client = io(url, { autoConnect: false, transports: ['websocket'], reconnection: false });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    const result = await socket.timeout(1000).emitWithAck('board:join', id);
    expect(result).toEqual({ ok: true });
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
  await db.board.create({
    data: {
      id: boardId, name: 'Tests', columns: { create: [
        { id: first, name: 'First', position: 0 }, { id: second, name: 'Second', position: 1 },
      ] },
      assignees: { create: [
        { id: actor, name: 'Test User', initials: 'TU' },
        { id: collaborator, name: 'Collaborator', initials: 'CO' },
      ] },
    },
  });
  await db.board.create({ data: {
    id: isolatedBoardId, name: 'Separate board',
    assignees: { create: { id: externalActor, name: 'Another user', initials: 'AU' } },
  } });
});

afterAll(async () => {
  try {
    await db?.board.deleteMany({ where: { id: { in: [boardId, isolatedBoardId] } } });
  } finally {
    await app?.close();
  }
});

beforeEach(async () => {
  await db.card.deleteMany({ where: { columnId: { in: [first, second] } } });
  await db.board.update({ where: { id: boardId }, data: { revision: 0 } });
});

it('persists CRUD with incrementing revisions and a board snapshot', async () => {
  const card = await create();
  const edited = await request(`/cards/${card.id}`, 'PATCH', { ...fields, expectedVersion: card.version, assigneeIds: [actor] });
  expect(edited.status).toBe(200);
  const { change } = await edited.json() as { change: BoardChange };
  expect(change.cards[0]).toMatchObject({ id: card.id, version: 2, assigneeIds: [actor] });
  expect(await snapshot()).toMatchObject({ revision: 2, columns: [{ cards: change.cards }, { cards: [] }] });

  const removed = await request(`/cards/${card.id}?expectedVersion=2`, 'DELETE');
  expect(await removed.json()).toEqual({ change: { boardId, revision: 3, cards: [], deletedCardIds: [card.id] } });
  expect(await snapshot()).toMatchObject({ revision: 3, columns: [{ cards: [] }, { cards: [] }] });
  const deleted = await move(card, second, null);
  expect(deleted.status).toBe(409);
  expect(await deleted.json()).toEqual({ code: 'CARD_VERSION_CONFLICT', card: null });
});

it('saves, moves, and clears multiple assignees without duplicate assignments', async () => {
  const created = await request('/cards', 'POST', {
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

  const cleared = await request(`/cards/${assigned.id}`, 'PATCH', { ...fields, expectedVersion: 2 });
  expect(cleared.status).toBe(200);
  const clearedChange = await cleared.json() as { change: BoardChange };
  expect(clearedChange.change.cards[0]).toMatchObject({ assigneeIds: [], version: 3 });
  expect((await snapshot()).columns[1].cards[0].assigneeIds).toEqual([]);
});

it('accepts only one concurrent write against a version', async () => {
  const card = await create();
  const responses = await Promise.all([
    move(card, second, null),
    request(`/cards/${card.id}`, 'PATCH', { ...fields, title: 'Concurrent edit', expectedVersion: card.version }),
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
  expect((await request('/cards', 'POST', { ...fields, columnId: 'missing' })).status).toBe(404);
  expect((await request('/cards', 'POST', { ...fields, columnId: first, assigneeIds: [actor, externalActor] })).status).toBe(400);
  const card = await create();
  expect((await move(card, 'missing', null)).status).toBe(404);
  expect((await move(card, first, card.id)).status).toBe(400);
  expect((await request(`/cards/${card.id}`, 'DELETE')).status).toBe(400);
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
    const response = await request('/cards', 'POST', { ...fields, columnId: first }, origin.id);
    expect(response.status).toBe(201);
    const { change } = await response.json() as { change: BoardChange };
    expect(await event).toEqual(change);
    expect((await snapshot()).revision).toBe(change.revision);

    const originBarrier = new Promise<BoardChange>((resolve) => origin.once('card:updated', resolve));
    const updated = await request(`/cards/${change.cards[0].id}`, 'PATCH', { ...fields, expectedVersion: 1 });
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
