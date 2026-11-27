import { boardSchema, calculateMidpointPosition, DEMO_BOARD_ID, mvpCardId, type Board, type Card, type CreateCard } from '@board/shared';
import { changeCard, RequestError } from './api';
import { patchCards } from './model';

export type TextField = 'title' | 'description';
export type TextEdit = { field: TextField; previous: string; value: string };
export type Creation = { kind: 'create'; key: string; input: CreateCard & { id: string } };
export type TextChange = TextEdit & { kind: 'text'; key: string; token: string; original: Card };
export type PendingChange = Creation | TextChange;
export type OfflineState = { offline: boolean; changes: PendingChange[] };

const empty: OfflineState = { offline: false, changes: [] };
export const findCard = (board: Board, id: string) =>
  board.columns.flatMap(({ cards }) => cards).find((card) => card.id === id);

export const cardId = (change: PendingChange) => change.kind === 'create' ? change.input.id : change.original.id;
export const textKey = (id: string, field: TextField) => `${id}:${field}`;

function upgradeMvpCard(card: Card): Card {
  const id = mvpCardId(card.id);
  return id === card.id ? card : { ...card, id };
}

function upgradeMvpTextEdit(change: PendingChange): PendingChange {
  if (change.kind !== 'text') return change;
  const original = upgradeMvpCard(change.original);
  return original === change.original ? change : { ...change, original, key: textKey(original.id, change.field) };
}

export function isConnectionError(error: unknown) {
  return error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')
    || (error instanceof RequestError && error.status >= 500);
}

export class OfflineStore {
  private readonly stateKey: string;
  private readonly snapshotKey: string;
  readonly replayLock: string;
  private readonly listeners = new Set<() => void>();
  private stored?: string | null;
  private state = empty;

  constructor(private readonly boardId: string, private readonly persist = true) {
    this.stateKey = `sprint-board:offline:v1:${boardId}`;
    this.snapshotKey = `${this.stateKey}:snapshot`;
    this.replayLock = `${this.stateKey}:replay`;
  }

  read = () => {
    if (!this.persist) return this.state;
    try {
      const stored = localStorage.getItem(this.stateKey);
      if (this.stored !== stored) {
        const state = stored ? JSON.parse(stored) as OfflineState : empty;
        this.state = this.boardId === DEMO_BOARD_ID ? { ...state, changes: state.changes.map(upgradeMvpTextEdit) } : state;
        this.stored = stored;
      }
    } catch {
      // Keep the last readable state if browser storage becomes unavailable.
    }
    return this.state;
  };

  subscribe = (listener: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === this.stateKey || event.key === null) listener();
    };
    this.listeners.add(listener);
    if (this.persist) window.addEventListener('storage', onStorage);
    return () => {
      this.listeners.delete(listener);
      if (this.persist) window.removeEventListener('storage', onStorage);
    };
  };

  async update(transform: (state: OfflineState) => OfflineState) {
    if (!this.persist) {
      this.state = transform(this.state);
      for (const listener of this.listeners) listener();
      return;
    }
    await navigator.locks.request(this.stateKey, () => {
      const current = this.read();
      const next = transform(current);
      if (next === current) return;
      localStorage.setItem(this.stateKey, JSON.stringify(next));
      for (const listener of this.listeners) listener();
    });
  }

  put(change: PendingChange) {
    return this.update((state) => {
      const prior = state.changes.find(({ key }) => key === change.key);
      const saved = state.offline && change.kind === 'text' && prior?.kind === 'text'
        ? { ...change, original: prior.original, previous: prior.previous } : change;
      const changes = prior
        ? state.changes.map((item) => item.key === change.key ? saved : item)
        : [...state.changes, saved];
      return { ...state, changes };
    });
  }

  remove(change: PendingChange) {
    return this.update((state) => ({
      ...state, changes: state.changes.filter((item) => !sameChange(item, change)),
    }));
  }

  snapshot() {
    if (!this.persist) return;
    try {
      const stored = localStorage.getItem(this.snapshotKey);
      if (stored) {
        const board = boardSchema.parse(JSON.parse(stored));
        return this.boardId === DEMO_BOARD_ID
          ? { ...board, columns: board.columns.map((column) => ({ ...column, cards: column.cards.map(upgradeMvpCard) })) }
          : board;
      }
    } catch {
      // The board can still be fetched online.
    }
  }

  async saveSnapshot(board: Board) {
    if (!this.persist) return;
    await navigator.locks.request(this.snapshotKey, () => {
      if ((this.snapshot()?.revision ?? -1) <= board.revision) {
        localStorage.setItem(this.snapshotKey, JSON.stringify(board));
      }
    });
  }
}

export function sameChange(left: PendingChange, right: PendingChange) {
  return left.key === right.key && (left.kind === 'create' || (right.kind === 'text' && left.token === right.token));
}

export function projectPending(board: Board, changes: readonly PendingChange[]) {
  return changes.reduce((current, change) => {
    const card = findCard(current, cardId(change));
    if (change.kind === 'text') {
      return card ? patchCards(current, [{ ...card, [change.field]: change.value }]) : current;
    }
    if (card) return current;
    const { input } = change;
    const column = current.columns.find(({ id }) => id === input.columnId);
    if (!column) return current;
    const position = calculateMidpointPosition(column.cards.at(-1)?.position);
    return patchCards(current, [{ ...input, position, version: 1 }]);
  }, board);
}

export function textDisposition(change: TextChange, card: Card | undefined) {
  if (!card) return 'deleted';
  if (card[change.field] === change.value) return 'applied';
  return card[change.field] === change.previous ? 'send' : 'conflict';
}

export async function sendPending(board: Board, change: PendingChange, approved?: string) {
  if (change.kind === 'create') return changeCard(board.id, { type: 'create', input: change.input });
  const card = findCard(board, change.original.id);
  if (!card || (approved === undefined && textDisposition(change, card) !== 'send')) return;
  if (approved !== undefined && card[change.field] !== approved) return;
  const { title, description, priority, tags, assigneeIds, version } = card;
  return changeCard(board.id, {
    type: 'update', id: card.id,
    input: { title, description, priority, tags, assigneeIds, expectedVersion: version, [change.field]: change.value },
  });
}
