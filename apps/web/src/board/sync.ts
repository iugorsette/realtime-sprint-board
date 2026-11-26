import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { Board, BoardChange, Card } from '@board/shared';
import { changeCard, fetchBoard, RequestError, type CardAction } from './api';
import { patchCards, previewMove, reconcileChanges } from './model';

export function boardOptions(boardId: string) {
  return queryOptions({
    queryKey: ['board', boardId] as const,
    queryFn: ({ signal }) => fetchBoard(boardId, signal),
    retry: false,
    networkMode: 'always',
  });
}

export class BoardSync {
  private events: BoardChange[] = [];
  private pending = false;
  private refresh?: Promise<void>;
  private refreshRequested = false;
  private lastGapRefreshRevision?: number;
  private active = false;
  readonly options;

  constructor(private readonly client: QueryClient, boardId: string) {
    this.options = boardOptions(boardId);
  }

  start() {
    this.active = true;
  }

  stop() {
    this.active = false;
    this.events = [];
    this.refreshRequested = false;
    this.lastGapRefreshRevision = undefined;
    void this.client.cancelQueries({ queryKey: this.options.queryKey });
  }

  receive(change: BoardChange) {
    if (!this.active || change.boardId !== this.options.queryKey[1]) return;
    this.events.push(change);
    this.lastGapRefreshRevision = undefined;
    this.drain();
  }

  resync() {
    this.refreshRequested = true;
    this.drain();
  }

  private drain() {
    if (!this.active || this.pending || this.refresh) return;
    const revision = this.applyEvents()?.revision ?? -1;
    const gapNeedsRefresh = this.events.length > 0 && this.lastGapRefreshRevision !== revision;
    if (!this.refreshRequested && !gapNeedsRefresh) return;

    this.refreshRequested = false;
    this.lastGapRefreshRevision = revision;
    this.refresh = this.client.fetchQuery(this.options).then(
      () => {
        this.refresh = undefined;
        this.drain();
      },
      () => {
        this.refresh = undefined;
        if (this.refreshRequested) this.drain();
      },
    );
  }

  private applyEvents() {
    const current = this.read();
    if (!current) return;
    const { board, remaining } = reconcileChanges(current, this.events);
    this.events = remaining;
    if (board !== current) this.write(board);
    return board;
  }

  private read() {
    return this.client.getQueryData(this.options.queryKey);
  }

  private write(board: Board) {
    this.client.setQueryData(this.options.queryKey, board);
  }

  async mutate(action: CardAction, socketId?: string) {
    if (this.pending) throw new Error('Another card change is in progress.');
    this.pending = true;
    let snapshot: Board | undefined;
    try {
      await this.client.cancelQueries({ queryKey: this.options.queryKey });
      snapshot = this.read();
      if (snapshot && action.type === 'move') {
        const card = snapshot.columns.flatMap(({ cards }) => cards).find(({ id }) => id === action.id);
        if (card) this.write(previewMove(snapshot, card, action.input));
      }
      const change = await changeCard(action, socketId);
      if (snapshot && action.type === 'move') this.write(snapshot);
      if (change) this.receive(change);
    } catch (error) {
      if (snapshot && action.type === 'move') this.write(snapshot);
      if (error instanceof RequestError && error.conflict && 'id' in action) {
        const current = this.applyEvents();
        const serverCard: Card | null = error.conflict.card;
        const cachedCard = current?.columns.flatMap(({ cards }) => cards).find(({ id }) => id === action.id);
        if (current && cachedCard && (!serverCard || cachedCard.version < serverCard.version)) {
          this.write(patchCards(current, serverCard ? [serverCard] : [], serverCard ? [] : [action.id]));
        }
      }
      this.refreshRequested = true;
      throw error;
    } finally {
      this.pending = false;
      this.drain();
    }
  }
}
