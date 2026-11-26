import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { BoardChange } from '@board/shared';
import { board, first, second, third } from './fixtures';
import { BoardSync } from './sync';
import { patchCards } from './model';

const move = { type: 'move', id: first.id, input: { targetColumnId: 'done', beforeCardId: third.id, expectedVersion: 1 } } as const;
const updatedThird = { ...third, title: 'Changed in another tab', version: 2 };
const external: BoardChange = { boardId: board.id, revision: 2, cards: [updatedThird], deletedCardIds: [] };

function setup() {
  const client = new QueryClient();
  const sync = new BoardSync(client, board.id);
  const read = () => client.getQueryData(sync.options.queryKey)!;
  return { sync, read };
}

function mockFetch() {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

it('previews a move and reconciles its response with a concurrent change', async () => {
  const fetchMock = mockFetch();
  let respond!: (response: Response) => void;
  fetchMock.mockResolvedValueOnce(Response.json(board)).mockImplementationOnce(
    () => new Promise((resolve) => { respond = resolve; }),
  );
  const { sync, read } = setup();
  sync.start();
  sync.resync();
  await vi.waitFor(() => expect(read()?.revision).toBe(1));

  const mutation = sync.mutate(move, 'origin');
  await vi.waitFor(() => expect(read().columns[1].cards[0].id).toBe(first.id));
  expect(fetchMock.mock.calls[1][1]?.headers).toBeInstanceOf(Headers);
  expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('x-socket-id')).toBe('origin');
  sync.receive(external);
  const moved = { ...first, columnId: 'done', version: 2, position: 0 };
  respond(Response.json({ change: { boardId: board.id, revision: 3, cards: [moved], deletedCardIds: [] } }));
  await mutation;
  expect(read()).toMatchObject({ revision: 3, columns: [{ cards: [second] }, { cards: [moved, updatedThird] }] });
  sync.stop();
});

it('rolls back an optimistic move, reconciles a 409 and fetches the current snapshot', async () => {
  const changed = { ...first, title: 'Authoritative title', version: 2 };
  const latest = { ...patchCards(board, [changed, updatedThird]), revision: 3 };
  const fetchMock = mockFetch();
  fetchMock.mockResolvedValueOnce(Response.json(board))
    .mockResolvedValueOnce(Response.json({ code: 'CARD_VERSION_CONFLICT', card: changed }, { status: 409 }))
    .mockResolvedValueOnce(Response.json(latest));
  const { sync, read } = setup();
  sync.start();
  sync.resync();
  await vi.waitFor(() => expect(read()?.revision).toBe(1));

  await expect(sync.mutate(move)).rejects.toMatchObject({ status: 409 });
  expect(read().columns[0].cards[0]).toEqual(changed);
  await vi.waitFor(() => expect(read()).toEqual(latest));
  sync.stop();
});

it('refreshes on revision gaps and on a reconnect, applying events that arrived during the snapshot', async () => {
  const newer = { ...second, version: 2, title: 'Updated' };
  const fetchMock = mockFetch();
  fetchMock.mockResolvedValueOnce(Response.json(board))
    .mockResolvedValueOnce(Response.json({ ...patchCards(board, [updatedThird]), revision: 2 }))
    .mockResolvedValueOnce(Response.json({ ...patchCards(board, [updatedThird, newer], [first.id]), revision: 4 }));
  const { sync, read } = setup();
  sync.start();
  sync.resync();
  await vi.waitFor(() => expect(read()?.revision).toBe(1));
  sync.receive({ boardId: board.id, revision: 3, cards: [newer], deletedCardIds: [] });
  await vi.waitFor(() => expect(read().revision).toBe(3));
  expect(read().columns[0].cards).toEqual([first, newer]);

  sync.resync();
  await vi.waitFor(() => expect(read().revision).toBe(4));
  expect(read().columns[0].cards).toEqual([newer]);
  sync.stop();
});

it('keeps a newer queued card when a conflict response arrives late', async () => {
  const newer = { ...first, title: 'Newer queued edit', version: 3 };
  const latest = { ...patchCards(board, [newer]), revision: 2 };
  const fetchMock = mockFetch();
  let respond!: (response: Response) => void;
  fetchMock.mockResolvedValueOnce(Response.json(board)).mockImplementationOnce(
    () => new Promise((resolve) => { respond = resolve; }),
  ).mockResolvedValueOnce(Response.json(latest));
  const { sync, read } = setup();
  sync.start();
  sync.resync();
  await vi.waitFor(() => expect(read()?.revision).toBe(1));

  const mutation = sync.mutate(move);
  await vi.waitFor(() => expect(read().columns[1].cards[0].id).toBe(first.id));
  sync.receive({ boardId: board.id, revision: 2, cards: [newer], deletedCardIds: [] });
  respond(Response.json({ code: 'CARD_VERSION_CONFLICT', card: { ...first, version: 2 } }, { status: 409 }));
  await expect(mutation).rejects.toMatchObject({ status: 409 });
  expect(read().columns[0].cards[0]).toEqual(newer);
  sync.stop();
});
