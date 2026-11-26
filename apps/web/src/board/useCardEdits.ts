import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updateCardSchema, type Board, type BoardChange, type Card } from '@board/shared';
import { RequestError, type CardAction } from './api';
import { applyCardEdit, type CardEdit } from './cardEdits';
import { boardOptions } from './sync';

type SaveCard = (action: CardAction) => Promise<BoardChange | null>;

export function useCardEdits(boardId: string, card: Card, save: SaveCard) {
  const client = useQueryClient();
  const tail = useRef(Promise.resolve());
  const acknowledged = useRef<Card>(undefined);
  const [queued, setQueued] = useState<CardEdit[]>([]);
  const [error, setError] = useState('');

  function edit(change: CardEdit) {
    setError('');
    setQueued((current) => [...current, change]);
    tail.current = tail.current.then(async () => {
      try {
        const board: Board | undefined = client.getQueryData(boardOptions(boardId).queryKey);
        const cached = board?.columns.flatMap(({ cards }) => cards).find(({ id }) => id === card.id);
        if (!cached) throw new Error('This card is no longer available.');
        const lastSaved = acknowledged.current;
        const base = lastSaved && lastSaved.version > cached.version ? lastSaved : cached;
        const updated = applyCardEdit(base, change);
        if (updated === base) return;
        if ('previous' in change && change.previous !== base[change.field]) {
          throw new Error('This field changed in another tab. Open the field again to edit it.');
        }
        if (change.field === 'columnId') {
          const result = await save({
            type: 'move', id: card.id,
            input: { targetColumnId: change.value, beforeCardId: null, expectedVersion: base.version },
          });
          acknowledged.current = result?.cards.find(({ id }) => id === card.id) ?? lastSaved;
          return;
        }
        const input = updateCardSchema.safeParse({
          title: updated.title, description: updated.description, priority: updated.priority,
          tags: updated.tags, assigneeIds: updated.assigneeIds, expectedVersion: base.version,
        });
        if (!input.success) throw new Error('Check the field value and try again.');
        const result = await save({ type: 'update', id: card.id, input: input.data });
        acknowledged.current = result?.cards.find(({ id }) => id === card.id) ?? lastSaved;
      } catch (error) {
        setError(error instanceof RequestError && error.status === 409
          ? 'This card changed in another tab. Try the field edit again.'
          : error instanceof Error ? error.message : 'Unable to save this change.');
      } finally {
        setQueued((current) => current.filter((item) => item !== change));
      }
    });
  }

  return { card: queued.reduce(applyCardEdit, card), edit, saving: queued.length > 0, error };
}
