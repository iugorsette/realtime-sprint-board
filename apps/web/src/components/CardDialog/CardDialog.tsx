import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { prioritySchema, type Board, type BoardChange, type Card } from '@board/shared';
import { RequestError, type CardAction } from '../../board/api';
import { useCardEdits } from '../../board/useCardEdits';
import { ChoiceMenu } from '../ChoiceMenu/ChoiceMenu';
import { AssigneePicker } from '../AssigneePicker/AssigneePicker';
import { Avatar, CardSurface, priorityNames } from '../CardTile/CardTile';
import { TagPicker } from '../TagPicker/TagPicker';
import { InlineText } from './InlineText';
import styles from './CardDialog.module.css';

function closeDisclosureOnBlur({ currentTarget, relatedTarget }: FocusEvent<HTMLDetailsElement>) {
  if (!currentTarget.contains(relatedTarget)) currentTarget.open = false;
}

function closeDisclosureOnEscape(event: KeyboardEvent<HTMLDetailsElement>) {
  if (event.key !== 'Escape' || !event.currentTarget.open) return;
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.open = false;
  event.currentTarget.querySelector('summary')?.focus();
}

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
  const deleteAction = useRef<HTMLButtonElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { card: displayed, edit, saving, error } = useCardEdits(board.id, card, onSave);
  const column = board.columns.find(({ id }) => id === displayed.columnId);
  const assigned = board.assignees.filter(({ id }) => displayed.assigneeIds.includes(id));
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
    requestAnimationFrame(() => deleteAction.current?.focus({ preventScroll: true }));
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
      <CardSurface className={styles.surface} data-column={column?.id}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <h2 ref={heading} tabIndex={-1} aria-label={displayed.title}>
              <InlineText label="Title" value={displayed.title} disabled={busyElsewhere}
                onSave={(value, previous) => edit({ field: 'title', value, previous })} />
            </h2>
            <button type="button" className={styles.icon} aria-label="Close card" disabled={busy} onClick={onClose}>
              <X size={19} aria-hidden="true" />
            </button>
          </div>
          <div className={styles.subheader} role="group" aria-label="Card properties">
            <div className={styles.property}>
              <span className={styles.propertyLabel}>Status</span>
              <ChoiceMenu label="Status" selected={[displayed.columnId]} disabled={busyElsewhere}
                trigger={<span className={styles.column} data-column={column?.id}>{column?.name ?? 'Status'}</span>}
                options={board.columns.map(({ id, name }) => ({ value: id, label: name, column: id }))}
                onSelect={(value) => edit({ field: 'columnId', value })} />
            </div>
            <div className={styles.property}>
              <span className={styles.propertyLabel}>Priority</span>
              <ChoiceMenu label="Priority" selected={[displayed.priority]} disabled={busyElsewhere}
                trigger={<span className={styles.priority} data-priority={displayed.priority}>{priorityNames[displayed.priority]}</span>}
                options={prioritySchema.options.map((value) => ({ value, label: priorityNames[value], priority: value }))}
                onSelect={(value) => edit({ field: 'priority', value })} />
            </div>
            <div className={`${styles.property} ${styles.assigneeProperty}`}>
              <span className={styles.propertyLabel}>Assignees</span>
              <details className={styles.assignees} onBlur={closeDisclosureOnBlur} onKeyDown={closeDisclosureOnEscape}
                onToggle={({ currentTarget }) => {
                  if (currentTarget.open) currentTarget.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
                }}>
                <summary className={styles.assigneeTrigger} aria-label="Edit assignees"
                  title={assigned.map(({ name }) => name).join(', ') || 'Add assignees'}>
                  {assigned.length > 0 && (
                    <span className={styles.avatars} aria-hidden="true">
                      {assigned.slice(0, 3).map((person) => <Avatar key={person.id} person={person} />)}
                      {assigned.length > 3 && <span className={styles.avatarOverflow}>+{assigned.length - 3}</span>}
                    </span>
                  )}
                  <span className={styles.assigneeAdd}><Plus size={15} aria-hidden="true" /></span>
                  {assigned.length === 0 && <span>Add people</span>}
                </summary>
                <div className={styles.assigneePopover}>
                  <AssigneePicker assignees={board.assignees} value={displayed.assigneeIds}
                    onChange={(ids) => changeList('assigneeIds', ids)} />
                </div>
              </details>
            </div>
          </div>
        </header>
        <div className={styles.details}>
          <section className={styles.description}>
            <h3>Description</h3>
            <InlineText label="Description" value={displayed.description} empty="Add a description" multiline
              disabled={busyElsewhere} onSave={(value, previous) => edit({ field: 'description', value, previous })} />
          </section>
          <section className={styles.tags}>
            <h3>Tags</h3>
            <TagPicker label="Tags" options={availableTags} value={displayed.tags} allowCreate compact
              onChange={(tags) => changeList('tags', tags)} />
          </section>
        </div>
        {(saving || error || deleteError) && (
          <div className={styles.feedback}>
            {saving && <span role="status">Saving changes…</span>}
            {(deleteError || error) && <span className={styles.error} role="alert">{deleteError || error}</span>}
          </div>
        )}
        <footer className={styles.footer}>
          {confirmDelete ? (
            <>
              <p>Delete this card?</p>
              <button ref={cancelDelete} type="button" className={styles.secondary} disabled={busy}
                onClick={cancelDeletion}>Cancel</button>
              <button type="button" className={styles.danger} disabled={busy}
                onClick={() => void deleteCard()}>Confirm delete</button>
            </>
          ) : (
            <button ref={deleteAction} type="button" className={styles.deleteAction} disabled={busy}
              onClick={() => setConfirmDelete(true)}>Delete card</button>
          )}
        </footer>
      </CardSurface>
    </dialog>
  );
}
