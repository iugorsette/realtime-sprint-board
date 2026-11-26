import { useEffect, useRef, useState } from 'react';
import { createCardSchema, type CreateCard } from '@board/shared';
import { CardSurface } from '../CardTile/CardTile';
import styles from './CardComposer.module.css';

export function CardComposer({ columnId, pending, onClose, onSave }: {
  columnId: string;
  pending: boolean;
  onClose: () => void;
  onSave: (input: CreateCard) => Promise<void>;
}) {
  const title = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => { title.current?.focus(); }, []);

  async function save(closeIfBlank = false) {
    if (pending || saving.current) return;
    const value = title.current?.value.trim();
    if (!value) {
      if (closeIfBlank) onClose();
      return;
    }

    const parsed = createCardSchema.safeParse({
      columnId,
      title: value,
      description: '',
      priority: 'MEDIUM',
      assigneeIds: [],
      tags: [],
    });
    if (!parsed.success) {
      setError('Enter a title of up to 120 characters.');
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
      <form aria-label="New card" aria-busy={pending} onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}>
        <input
          ref={title}
          className={styles.title}
          name="title"
          aria-label="Title"
          placeholder="Enter a title…"
          enterKeyHint="done"
          maxLength={120}
          readOnly={pending}
          onChange={() => setError('')}
          onBlur={() => void save(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !event.nativeEvent.isComposing && !pending && !saving.current) {
              event.preventDefault();
              onClose();
            }
          }}
        />
        {pending && <span className={styles.status} role="status">Saving…</span>}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </form>
    </CardSurface>
  );
}
