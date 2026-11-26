import { useEffect, useRef, useState } from 'react';
import { createCardSchema, type Assignee, type CreateCard } from '@board/shared';
import { CardFields, readCardFields } from '../CardFields/CardFields';
import { CardSurface } from '../CardTile/CardTile';
import styles from './CardComposer.module.css';

export function CardComposer({ columnId, assignees, pending, onClose, onSave }: {
  columnId: string;
  assignees: Assignee[];
  pending: boolean;
  onClose: () => void;
  onSave: (input: CreateCard) => Promise<void>;
}) {
  const title = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => { title.current?.focus(); }, []);

  async function save(form: HTMLFormElement) {
    if (pending || saving.current) return;
    const fields = readCardFields(form);
    if (!String(fields.title ?? '').trim()) return;
    const parsed = createCardSchema.safeParse({ ...fields, columnId });
    if (!parsed.success) {
      setError('Check the title and use up to 10 tags of 30 characters each.');
      return;
    }
    saving.current = true;
    setError('');
    try {
      await onSave(parsed.data);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to create this card.');
    } finally {
      saving.current = false;
    }
  }

  return (
    <CardSurface className={styles.card}>
      <form
        aria-label="New card"
        onSubmit={(event) => {
          event.preventDefault();
          void save(event.currentTarget);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) void save(event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !pending && !saving.current) {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <CardFields titleRef={title} assignees={assignees} pending={pending} />
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.footer}>
          <span role="status">{pending ? 'Saving…' : 'Saves when you leave the card'}</span>
          <button type="submit" hidden disabled={pending}>Create card</button>
          <button type="button" onPointerDown={(event) => event.preventDefault()}
            onClick={onClose} disabled={pending}>Cancel</button>
        </div>
      </form>
    </CardSurface>
  );
}
