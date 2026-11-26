import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Trash2, X } from 'lucide-react';
import { createCardSchema, type Board, type Card } from '@board/shared';
import type { CardAction } from '../../board/api';
import { CardSurface } from '../CardTile/CardTile';
import { CardFields, readCardFields } from '../CardFields/CardFields';
import styles from './CardDialog.module.css';

export type Editor = { columnId: string; card?: Card };

export function CardDialog({ board, editor, pending, onClose, onSave }: {
  board: Board;
  editor: Editor;
  pending: boolean;
  onClose: () => void;
  onSave: (action: CardAction) => Promise<void>;
}) {
  const card = editor.card;
  const column = board.columns.find(({ id }) => id === editor.columnId);
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
    const form = event.currentTarget;
    const result = createCardSchema.safeParse({
      ...readCardFields(form),
      columnId: card?.columnId ?? new FormData(form).get('column'),
    });
    if (!result.success) {
      setError('Enter a title and up to 10 tags of 30 characters each.');
      return;
    }
    if (card) {
      const { columnId, ...updates } = result.data;
      void columnId;
      void save({ type: 'update', id: card.id, input: { ...updates, expectedVersion: card.version } });
    } else {
      void save({ type: 'create', input: result.data });
    }
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
              {card && column && <span className={styles.column}>{column.name}</span>}
              <h2 id="editor-title">{card?.title ?? 'New card'}</h2>
            </div>
            <button className={styles.icon} type="button" aria-label="Close" onClick={onClose} disabled={pending}><X size={19} /></button>
          </div>
          <div className={styles.body}>
            {confirmDelete && card ? (
              <p className={styles.confirm}>Delete <strong>{card.title}</strong>? This action can’t be undone.</p>
            ) : (
              <div className={styles.editor}>
                <CardFields card={card} titleRef={title} assignees={board.assignees} pending={pending} />
                {!card && <label>Column<select name="column" defaultValue={editor.columnId}>
                  {board.columns.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                </select></label>}
              </div>
            )}
            {error && <p role="alert" className={styles.error}>{error}</p>}
          </div>
          <div className={styles.footer}>
            {card && !confirmDelete && <button type="button" className={styles.remove} disabled={pending} onClick={() => setConfirmDelete(true)}>
              <Trash2 size={15} /> Delete
            </button>}
            <button type="button" className={styles.secondary} onClick={confirmDelete ? () => setConfirmDelete(false) : onClose} disabled={pending}>Cancel</button>
            {confirmDelete && card ? (
              <button type="button" className={styles.danger} disabled={pending}
                onClick={() => void save({ type: 'delete', id: card.id, version: card.version })}>Delete card</button>
            ) : (
              <button type="submit" className={styles.primary} disabled={pending}>{pending ? 'Saving…' : card ? 'Save changes' : 'Create card'}</button>
            )}
          </div>
        </form>
      </CardSurface>
    </dialog>
  );
}
