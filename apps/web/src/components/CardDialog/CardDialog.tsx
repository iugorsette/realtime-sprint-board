import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Trash2, X } from 'lucide-react';
import { updateCardSchema, type Board, type Card } from '@board/shared';
import type { CardAction } from '../../board/api';
import { CardSurface } from '../CardTile/CardTile';
import { CardFields, readCardFields } from '../CardFields/CardFields';
import styles from './CardDialog.module.css';

export function CardDialog({ board, card, pending, onClose, onSave }: {
  board: Board;
  card: Card;
  pending: boolean;
  onClose: () => void;
  onSave: (action: CardAction) => Promise<void>;
}) {
  const column = board.columns.find(({ id }) => id === card.columnId);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    title.current?.focus();
    return () => element?.close();
  }, []);

  async function save(action: CardAction) {
    setError('');
    try {
      await onSave(action);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save this card.');
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = updateCardSchema.safeParse({
      ...readCardFields(event.currentTarget),
      expectedVersion: card.version,
    });
    if (!result.success) {
      setError('Enter a title and up to 10 tags of 30 characters each.');
      return;
    }
    void save({ type: 'update', id: card.id, input: result.data });
  }

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="editor-title" onCancel={(event) => {
      event.preventDefault();
      if (!pending) onClose();
    }}>
      <CardSurface>
        <form onSubmit={submit}>
          <div className={styles.header}>
            <div>
              {column && <span className={styles.column}>{column.name}</span>}
              <h2 id="editor-title">{card.title}</h2>
            </div>
            <button className={styles.icon} type="button" aria-label="Close" onClick={onClose} disabled={pending}><X size={19} /></button>
          </div>
          <div className={styles.body}>
            {confirmDelete ? (
              <p className={styles.confirm}>Delete <strong>{card.title}</strong>? This action can’t be undone.</p>
            ) : (
              <CardFields card={card} titleRef={title} assignees={board.assignees} pending={pending} />
            )}
            {error && <p role="alert" className={styles.error}>{error}</p>}
          </div>
          <div className={styles.footer}>
            {!confirmDelete && <button type="button" className={styles.remove} disabled={pending} onClick={() => setConfirmDelete(true)}>
              <Trash2 size={15} /> Delete
            </button>}
            <button type="button" className={styles.secondary} onClick={confirmDelete ? () => setConfirmDelete(false) : onClose} disabled={pending}>Cancel</button>
            {confirmDelete ? (
              <button type="button" className={styles.danger} disabled={pending}
                onClick={() => void save({ type: 'delete', id: card.id, version: card.version })}>Delete card</button>
            ) : (
              <button type="submit" className={styles.primary} disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</button>
            )}
          </div>
        </form>
      </CardSurface>
    </dialog>
  );
}
