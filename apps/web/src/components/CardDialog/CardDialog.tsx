import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { prioritySchema, type Board, type BoardChange, type Card } from '@board/shared';
import { RequestError, type CardAction } from '../../board/api';
import { useCardEdits, type CardEditResult } from '../../board/useCardEdits';
import type { TextChange, TextEdit, TextField } from '../../board/offline';
import { ChoiceMenu } from '../ChoiceMenu/ChoiceMenu';
import { AssigneePicker } from '../AssigneePicker/AssigneePicker';
import { Avatar, CardSurface, priorityNames } from '../CardTile/CardTile';
import { TagPicker } from '../TagPicker/TagPicker';
import { InlineText } from './InlineText';
import { ConflictField, type ResolveConflict } from './ConflictField';
import { CardShare } from './CardShare';
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

type CardReview = {
  changes: TextChange[];
  deleted: boolean;
  notice: string;
  onResolve: ResolveConflict;
  onRecoverDeleted: (change: TextChange) => Promise<void>;
  onNext?: () => void;
  onSyncSettings: () => void;
};

export function CardDialog({ board, card, availableTags, pending, offline, syncing, savedTitle, readOnly = false, review, onReview, onClose, onSave,
  onSaveText, onDiscardText, onWorkOffline }: {
  board: Board;
  card: Card;
  availableTags: string[];
  pending: boolean;
  offline: boolean;
  syncing: boolean;
  savedTitle?: string;
  readOnly?: boolean;
  review?: CardReview;
  onReview?: () => void;
  onClose: () => void;
  onSave: (action: CardAction) => Promise<BoardChange | null>;
  onSaveText: (card: Card, change: TextEdit, send: () => Promise<CardEditResult>) => Promise<CardEditResult>;
  onDiscardText: (card: Card, field: TextField, value: string) => void;
  onWorkOffline?: () => Promise<boolean>;
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
  const busy = pending || saving || syncing;
  const busyElsewhere = pending && !saving;
  const propertiesDisabled = readOnly || offline || syncing || busyElsewhere || Boolean(review);
  const titleConflict = review?.changes.find(({ field }) => field === 'title');
  const descriptionConflict = review?.changes.find(({ field }) => field === 'description');

  function textProps(field: TextField) {
    return {
      value: card[field],
      disabled: readOnly || busyElsewhere || syncing || Boolean(onReview),
      onSave: (value: string, previous: string) => {
        const change = { field, value, previous };
        return onSaveText(card, change, () => edit(change));
      },
      onDiscard: (value: string) => onDiscardText(card, field, value),
      onWorkOffline,
    };
  }

  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => element?.close();
  }, []);

  useEffect(() => {
    if (confirmDelete) cancelDelete.current?.focus({ preventScroll: true });
  }, [confirmDelete]);

  useEffect(() => {
    if (review && !dialog.current?.contains(document.activeElement)) heading.current?.focus({ preventScroll: true });
  }, [review]);

  function cancelDeletion() {
    setConfirmDelete(false);
    setDeleteError('');
    requestAnimationFrame(() => deleteAction.current?.focus({ preventScroll: true }));
  }

  async function deleteCard() {
    if (busy || offline || readOnly) return;
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
    if (propertiesDisabled) return;
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
      <CardSurface className={styles.surface} data-column-color={column?.color}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            {review ? <h2 className={styles.titleEditor} ref={heading} tabIndex={-1}>{card.title}</h2>
              : <InlineText label="Title" heading={heading} {...textProps('title')} />}
            <div className={styles.titleActions}>
              {!review && <CardShare cardId={card.id} savedTitle={savedTitle} />}
              <button type="button" className={styles.icon} aria-label="Close card" disabled={busy} onClick={onClose}>
                <X size={19} aria-hidden="true" />
              </button>
            </div>
          </div>
          {review && (
            <p className={styles.reviewNote}>{review.deleted ? 'This card was deleted on the server.' : 'Review conflicting changes'}</p>
          )}
          {review && titleConflict && (
            <section className={styles.titleConflict}>
              <h3>Title</h3>
              <ConflictField change={titleConflict} server={review.deleted ? undefined : card.title}
                disabled={busy} onResolve={review.onResolve} />
            </section>
          )}
          <div className={styles.subheader} role="group" aria-label="Card properties">
            <div className={styles.property}>
              <span className={styles.propertyLabel}>Status</span>
              <ChoiceMenu label="Status" selected={[displayed.columnId]} disabled={propertiesDisabled}
                trigger={<span className={styles.column}>{column?.name ?? 'Status'}</span>}
                options={board.columns.map(({ id, name, color }) => ({ value: id, label: name, columnColor: color }))}
                onSelect={(value) => edit({ field: 'columnId', value })} />
            </div>
            <div className={styles.property}>
              <span className={styles.propertyLabel}>Priority</span>
              <ChoiceMenu label="Priority" selected={[displayed.priority]} disabled={propertiesDisabled}
                trigger={<span className={styles.priority} data-priority={displayed.priority}>{priorityNames[displayed.priority]}</span>}
                options={prioritySchema.options.map((value) => ({ value, label: priorityNames[value], priority: value }))}
                onSelect={(value) => edit({ field: 'priority', value })} />
            </div>
            <div className={`${styles.property} ${styles.assigneeProperty}`}>
              <span className={styles.propertyLabel}>Assignees</span>
              {propertiesDisabled ? <span className={styles.readOnlyProperty}>{assigned.map(({ name }) => name).join(', ') || 'Unassigned'}</span> :
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
              </details>}
            </div>
          </div>
        </header>
        <div className={styles.details}>
          <section className={styles.description}>
            <h3>Description</h3>
            {review ? (
              descriptionConflict ? <ConflictField change={descriptionConflict} server={review.deleted ? undefined : card.description}
                disabled={busy} onResolve={review.onResolve} /> : <p className={styles.reviewText}>{card.description || 'No description'}</p>
            ) : <InlineText label="Description" empty="Add a description" multiline {...textProps('description')} />}
          </section>
          <section className={styles.tags}>
            <h3>Tags</h3>
            {propertiesDisabled ? <span className={styles.readOnlyProperty}>{displayed.tags.join(', ') || 'No tags'}</span> :
              <TagPicker label="Tags" options={availableTags} value={displayed.tags} allowCreate compact
                onChange={(tags) => changeList('tags', tags)} />}
          </section>
        </div>
        {(saving || error || deleteError || review?.notice || (review && syncing)) && (
          <div className={styles.feedback}>
            {saving && <span role="status">Saving changes…</span>}
            {review && syncing && <span role="status">Syncing changes…</span>}
            {(deleteError || error || review?.notice) && <span className={styles.error} role="alert">{deleteError || error || review?.notice}</span>}
          </div>
        )}
        {!readOnly && <footer className={styles.footer}>
          {review ? (
            <>
              <button type="button" className={styles.secondary} disabled={busy} onClick={review.onSyncSettings}>Sync settings</button>
              {review.onNext && <button type="button" className={styles.secondary} disabled={busy} onClick={review.onNext}>Next card</button>}
              {review.deleted && (
                <button type="button" className={styles.applyDraft} disabled={busy}
                  onClick={() => void review.onRecoverDeleted(review.changes[0])}>Save as new card</button>
              )}
            </>
          ) : onReview ? (
            <button type="button" className={styles.applyDraft} disabled={busy} onClick={onReview}>Review changes</button>
          ) : offline ? <p>Titles and descriptions can be edited offline.</p> : confirmDelete ? (
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
        </footer>}
      </CardSurface>
    </dialog>
  );
}
