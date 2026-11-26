import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Board, Card, CreateCard } from '@board/shared';
import { fetchBoard, RequestError } from './api';
import {
  cardId, findCard, isConnectionError, OfflineStore, projectPending, sameChange,
  sendPending, textDisposition, textKey, type Creation, type PendingChange, type TextChange, type TextEdit,
} from './offline';
import { useBoard } from './useBoard';
import type { CardEditResult } from './useCardEdits';

const storageError = 'Could not save in this browser. Keep this page open and try again.';
function saveError(error: unknown) {
  return isConnectionError(error) ? 'Could not reach the server. Try again when you have a connection.'
    : error instanceof Error ? error.message : 'Unable to sync changes.';
}

function findConflicts(board: Board, changes: PendingChange[]) {
  const creations = new Set(changes.filter((change) => change.kind === 'create').map(cardId));
  return changes.filter((change): change is TextChange => {
    if (change.kind !== 'text' || creations.has(cardId(change))) return false;
    const disposition = textDisposition(change, findCard(board, cardId(change)));
    return disposition === 'conflict' || disposition === 'deleted';
  });
}

export function useOfflineBoard(boardId: string) {
  const store = useMemo(() => new OfflineStore(boardId), [boardId]);
  const state = useSyncExternalStore(store.subscribe, store.read);
  const online = useBoard(boardId, store, state.offline);
  const server = online.query.data;
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');
  const syncBusy = useRef(false);
  const board = useMemo(() => server && (state.offline ? projectPending(server, state.changes) : server),
    [server, state]);
  const pendingCards = useMemo(() => new Set(state.changes.map(cardId)), [state.changes]);
  const conflicts = useMemo(() => server && !state.offline ? findConflicts(server, state.changes) : [], [server, state]);

  async function workOffline() {
    setNotice('');
    try {
      if (server) await store.saveSnapshot(server);
      await store.update((current) => ({ ...current, offline: true }));
      return true;
    } catch {
      setNotice(storageError);
      return false;
    }
  }

  async function create(input: CreateCard & { id: string }) {
    const change: Creation = { kind: 'create', key: input.id, input };
    try {
      await store.put(change);
    } catch {
      throw new Error(storageError);
    }
    if (store.read().offline) return;
    try {
      const result = await online.mutation.mutateAsync({ type: 'create', input });
      if (!result) online.retry();
      await store.remove(change);
    } catch (error) {
      if (!isConnectionError(error)) await store.remove(change);
      throw error;
    }
  }

  async function saveText(card: Card, edit: TextEdit, send: () => Promise<CardEditResult>): Promise<CardEditResult> {
    const change: TextChange = {
      ...edit, kind: 'text', key: textKey(card.id, edit.field), token: crypto.randomUUID(), original: card,
    };
    try {
      await store.put(change);
    } catch {
      return { status: 'error', message: storageError };
    }
    if (store.read().offline) return { status: 'saved' };
    const result = await send();
    const retain = (result.status === 'conflict' && result.deleted) || (result.status === 'error' && result.offlineAvailable);
    if (!retain) {
      try {
        await store.remove(change);
      } catch {
        setNotice(storageError);
      }
    }
    return result.status === 'error' && result.offlineAvailable
      ? { ...result, message: 'Could not reach the server. Your draft is saved on this device.' } : result;
  }

  async function discardCreation(id: string) {
    try {
      await store.update((current) => ({
        ...current, changes: current.changes.filter((change) => change.kind !== 'create' || change.input.id !== id),
      }));
    } catch {
      setNotice(storageError);
    }
  }

  async function discardText(card: Card, field: TextEdit['field'], value: string) {
    try {
      await store.update((current) => ({
        ...current, changes: current.changes.filter((change) => change.kind !== 'text'
          || change.key !== textKey(card.id, field) || change.value !== value),
      }));
    } catch {
      setNotice(storageError);
    }
  }

  async function refresh(): Promise<Board> {
    const snapshot = await fetchBoard(boardId);
    await store.saveSnapshot(snapshot);
    online.acceptSnapshot(snapshot);
    return snapshot;
  }

  async function duringSync<T>(run: () => Promise<T>) {
    if (syncBusy.current) return;
    syncBusy.current = true;
    setSyncing(true);
    setNotice('');
    try {
      return await navigator.locks.request(store.replayLock, run);
    } catch (error) {
      setNotice(saveError(error));
    } finally {
      syncBusy.current = false;
      setSyncing(false);
    }
  }

  function resume() {
    return duringSync(async () => {
      let snapshot = await refresh();
      for (const change of store.read().changes) {
        for (let attempt = 0; attempt < 2; attempt++) {
          if (!store.read().changes.some((current) => sameChange(current, change))) break;
          try {
            if (change.kind === 'text' && textDisposition(change, findCard(snapshot, cardId(change))) === 'applied') {
              await store.remove(change);
              break;
            }
            if (await sendPending(snapshot, change) === undefined) break;
            snapshot = await refresh();
            await store.remove(change);
            break;
          } catch (error) {
            if (!(error instanceof RequestError) || error.status !== 409 || change.kind !== 'text') throw error;
            snapshot = await refresh();
          }
        }
      }
      await store.update((current) => ({ ...current, offline: false }));
      return findConflicts(snapshot, store.read().changes).length > 0;
    });
  }

  function resolve(change: TextChange, choice: 'mine' | 'server', reviewed?: string) {
    return duringSync(async () => {
      if (!store.read().changes.some((current) => sameChange(current, change))) return;
      const snapshot = await refresh();
      const card = findCard(snapshot, cardId(change));
      if (card?.[change.field] === change.value) {
        await store.remove(change);
        return;
      }
      if (card?.[change.field] !== reviewed) {
        setNotice('The server version changed. Review the new value before deciding.');
        return;
      }
      if (choice === 'mine') {
        if (!card || reviewed === undefined) return;
        try {
          if (await sendPending(snapshot, change, reviewed) === undefined) return;
        } catch (error) {
          if (!(error instanceof RequestError) || error.status !== 409) throw error;
          await refresh();
          setNotice('The server version changed. Review the new value before deciding.');
          return;
        }
        await refresh();
      }
      await store.remove(change);
    });
  }

  async function recoverDeleted(change: TextChange) {
    let recovered = false;
    await duringSync(async () => {
      const snapshot = await refresh();
      if (findCard(snapshot, cardId(change))) return;
      await store.update((current) => {
        if (!current.changes.some((entry) => sameChange(entry, change))) return current;
        const edits = current.changes.filter((entry): entry is TextChange => entry.kind === 'text' && cardId(entry) === cardId(change));
        const card = edits.reduce((value, edit) => ({ ...value, [edit.field]: edit.value }), change.original);
        const column = snapshot.columns.find(({ id }) => id === card.columnId) ?? snapshot.columns[0];
        if (!column) return current;
        const id = crypto.randomUUID();
        const input = {
          id, columnId: column.id, title: card.title, description: card.description, priority: card.priority,
          tags: card.tags, assigneeIds: card.assigneeIds.filter((id) => snapshot.assignees.some((person) => person.id === id)),
        };
        recovered = true;
        return { ...current, changes: [...current.changes.filter((entry) => !edits.some((edit) => sameChange(entry, edit))),
          { kind: 'create', key: id, input }] };
      });
    });
    if (recovered) await resume();
  }

  return {
    ...online, board, server, offline: state.offline, syncing, notice, setNotice, conflicts, pendingCards,
    pendingCount: state.changes.length, workOffline, resume, create, discardCreation, saveText, discardText, resolve, recoverDeleted,
  };
}
