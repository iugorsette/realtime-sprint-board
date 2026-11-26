import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updateCardSchema, type Board, type BoardChange, type Card } from '@board/shared';
import { RequestError, type CardAction } from './api';
import { applyCardEdit, type CardEdit } from './cardEdits';
import { boardOptions } from './sync';

type SaveCard = (action: CardAction) => Promise<BoardChange | null>;
export type CardEditResult =
  | { status: 'saved' }
  | { status: 'conflict' }
  | { status: 'error'; message: string };

export function useCardEdits(boardId: string, card: Card, save: SaveCard) {
  const client = useQueryClient();
  const tail = useRef(Promise.resolve());
  const acknowledged = useRef<Card>(undefined);
  const [queued, setQueued] = useState<CardEdit[]>([]);
  const [error, setError] = useState('');

  function edit(change: CardEdit) {
    setError('');
    setQueued((current) => [...current, change]);
    const result = tail.current.then(async (): Promise<CardEditResult> => {
      try {
        const board: Board | undefined = client.getQueryData(boardOptions(boardId).queryKey);
        const cached = board?.columns.flatMap(({ cards }) => cards).find(({ id }) => id === card.id);
        if (!cached) throw new Error('This card is no longer available.');
        const lastSaved = acknowledged.current;
        const base = lastSaved && lastSaved.version > cached.version ? lastSaved : cached;
        const updated = applyCardEdit(base, change);
        if (updated === base) return { status: 'saved' };
        if ('previous' in change && change.previous !== base[change.field]) {
          return { status: 'conflict' };
        }
        if (change.field === 'columnId') {
          const result = await save({
            type: 'move', id: card.id,
            input: { targetColumnId: change.value, beforeCardId: null, expectedVersion: base.version },
          });
          acknowledged.current = result?.cards.find(({ id }) => id === card.id) ?? lastSaved;
          return { status: 'saved' };
        }
        const input = updateCardSchema.safeParse({
          title: updated.title, description: updated.description, priority: updated.priority,
          tags: updated.tags, assigneeIds: updated.assigneeIds, expectedVersion: base.version,
        });
        if (!input.success) throw new Error('Check the field value and try again.');
        const result = await save({ type: 'update', id: card.id, input: input.data });
        acknowledged.current = result?.cards.find(({ id }) => id === card.id) ?? lastSaved;
        return { status: 'saved' };
      } catch (error) {
        const conflict = error instanceof RequestError && error.status === 409;
        if (conflict && 'previous' in change) return { status: 'conflict' };
        const message = conflict
          ? 'This card changed in another tab. Try the field edit again.'
          : error instanceof Error ? error.message : 'Unable to save this change.';
        if (!('previous' in change)) setError(message);
        return { status: 'error', message };
      } finally {
        setQueued((current) => current.filter((item) => item !== change));
      }
    });
    tail.current = result.then(() => undefined);
    return result;
  }

  return { card: queued.reduce(applyCardEdit, card), edit, saving: queued.length > 0, error };
}
