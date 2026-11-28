import { boardSchema, type BoardChange, type CardConflict, type CreateCard, type MoveCard, type UpdateCard } from '@board/shared';

export class RequestError extends Error {
  constructor(readonly status: number, readonly conflict?: CardConflict) {
    super(status === 409 ? 'This card changed in another tab. Reopen it to see the latest version.' : 'The request failed. Please try again.');
  }
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`/api${path}`, init);
  if (!response.ok) {
    const conflict = response.status === 409 ? await response.json() as CardConflict : undefined;
    throw new RequestError(response.status, conflict);
  }
  return response.json();
}

export async function fetchBoard(boardId: string, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(10000);
  return boardSchema.parse(await request(`/boards/${encodeURIComponent(boardId)}`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  }));
}

export type CardAction =
  | { type: 'create'; input: CreateCard }
  | { type: 'update'; id: string; input: UpdateCard }
  | { type: 'move'; id: string; input: MoveCard }
  | { type: 'delete'; id: string; version: number };

export async function changeCard(boardId: string, action: CardAction, socketId?: string): Promise<BoardChange | null> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const signal = AbortSignal.timeout(10000);
  const cards = `/boards/${encodeURIComponent(boardId)}/cards`;
  if (socketId) headers.set('x-socket-id', socketId);
  if (action.type === 'create') {
    return (await request(cards, { method: 'POST', headers, signal, body: JSON.stringify(action.input) })).change;
  }
  const path = `${cards}/${encodeURIComponent(action.id)}`;
  if (action.type === 'delete') {
    return (await request(`${path}?expectedVersion=${action.version}`, { method: 'DELETE', headers, signal })).change;
  }
  return (await request(action.type === 'move' ? `${path}/move` : path, {
    method: 'PATCH', headers, signal, body: JSON.stringify(action.input),
  })).change;
}
