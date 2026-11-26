import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Flag, Tags, Trash2, Users, X } from 'lucide-react';
import { prioritySchema, type Board, type BoardChange, type Card } from '@board/shared';
import { RequestError, type CardAction } from '../../board/api';
import { useCardEdits } from '../../board/useCardEdits';
import { AssigneePicker } from '../AssigneePicker/AssigneePicker';
import { CardSurface, priorityNames } from '../CardTile/CardTile';
import { TagPicker } from '../TagPicker/TagPicker';
import { InlineText } from './InlineText';
import styles from './CardDialog.module.css';

export function CardDialog({ board, card, availableTags, pending, onClose, onSave }: {
  board: Board;
  card: Card;
  availableTags: string[];
  pending: boolean;
  onClose: () => void;
  onSave: (action: CardAction) => Promise<BoardChange | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { card: displayed, edit, saving, error } = useCardEdits(board.id, card, onSave);
  const column = board.columns.find(({ id }) => id === card.columnId);
  const busy = pending || saving;
  const busyElsewhere = pending && !saving;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => element?.close();
  }, []);

  useEffect(() => {
    if (confirmDelete) cancelDelete.current?.focus({ preventScroll: true });
  }, [confirmDelete]);

  function cancelDeletion() {
    setConfirmDelete(false);
    setDeleteError('');
    deleteButton.current?.focus({ preventScroll: true });
  }

  async function deleteCard() {
    if (busy) return;
    setDeleteError('');
    try {
      await onSave({ type: 'delete', id: card.id, version: card.version });
      onClose();
    } catch (error) {
      setDeleteError(error instanceof RequestError && error.status === 409
        ? 'This card changed in another tab. Confirm again to delete the latest version.'
        : error instanceof Error ? error.message : 'Unable to delete this card.');
    }
  }

  function changeList(field: 'tags' | 'assigneeIds', next: string[]) {
    if (busyElsewhere) return;
    const current = displayed[field];
    const added = next.find((item) => !current.includes(item));
    const removed = current.find((item) => !next.includes(item));
    if (added) edit({ field, value: added, operation: 'add' });
    if (removed) edit({ field, value: removed, operation: 'remove' });
  }

  return (
    <dialog ref={dialog} className={styles.dialog} aria-label={displayed.title} onCancel={(event) => {
      event.preventDefault();
      if (busy) return;
      if (confirmDelete) cancelDeletion();
      else onClose();
    }}>
      <CardSurface className={styles.surface}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            {column && <span className={styles.column}>{column.name}</span>}
            <h2 ref={heading} tabIndex={-1} aria-label={displayed.title}>
              <InlineText label="Title" value={displayed.title} disabled={busyElsewhere}
                onSave={(value, previous) => edit({ field: 'title', value, previous })} />
            </h2>
          </div>
          <div className={styles.headerActions}>
            <button ref={deleteButton} type="button" className={styles.icon} aria-label="Delete card"
              disabled={busy} onClick={() => setConfirmDelete(true)}>
              <Trash2 size={17} aria-hidden="true" />
            </button>
            <button type="button" className={styles.icon} aria-label="Close card" disabled={busy} onClick={onClose}>
              <X size={19} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className={styles.details}>
          <section className={styles.description}>
            <h3>Description</h3>
            <InlineText label="Description" value={displayed.description} empty="Add a description" multiline
              disabled={busyElsewhere} onSave={(value, previous) => edit({ field: 'description', value, previous })} />
          </section>
          <dl className={styles.properties}>
            <div>
              <dt><Flag size={14} aria-hidden="true" /> Priority</dt>
              <dd className={styles.priority} data-priority={displayed.priority}>
                <select aria-label="Priority" value={displayed.priority} disabled={busyElsewhere} onChange={(event) => {
                  const value = prioritySchema.parse(event.target.value);
                  edit({ field: 'priority', value });
                }}>
                  {prioritySchema.options.map((priority) => (
                    <option key={priority} value={priority}>{priorityNames[priority]}</option>
                  ))}
                </select>
                <ChevronDown size={13} aria-hidden="true" />
              </dd>
            </div>
            <div>
              <dt><Users size={14} aria-hidden="true" /> Assignees</dt>
              <dd>
                <AssigneePicker assignees={board.assignees} value={displayed.assigneeIds} compact
                  onChange={(ids) => changeList('assigneeIds', ids)} />
              </dd>
            </div>
            <div>
              <dt><Tags size={14} aria-hidden="true" /> Tags</dt>
              <dd>
                <TagPicker label="Tags" options={availableTags} value={displayed.tags} allowCreate compact
                  onChange={(tags) => changeList('tags', tags)} />
              </dd>
            </div>
          </dl>
        </div>
        {(saving || error || deleteError) && (
          <div className={styles.feedback}>
            {saving && <span role="status">Saving changes…</span>}
            {(deleteError || error) && <span className={styles.error} role="alert">{deleteError || error}</span>}
          </div>
        )}
        {confirmDelete && (
          <footer className={styles.footer}>
            <p>Delete this card?</p>
            <button ref={cancelDelete} type="button" className={styles.secondary} disabled={busy}
              onClick={cancelDeletion}>Cancel</button>
            <button type="button" className={styles.danger} disabled={busy}
              onClick={() => void deleteCard()}>Confirm delete</button>
          </footer>
        )}
      </CardSurface>
    </dialog>
  );
}
