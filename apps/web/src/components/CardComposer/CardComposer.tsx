import { useEffect, useRef, useState } from 'react';
import { createCardSchema, type CreateCard } from '@board/shared';
import { isConnectionError } from '../../board/offline';
import { CardSurface } from '../CardTile/CardTile';
import styles from './CardComposer.module.css';

export function CardComposer({ columnId, pending, offline, onClose, onSave, onDiscard, onWorkOffline }: {
  columnId: string;
  pending: boolean;
  offline: boolean;
  onClose: () => void;
  onSave: (input: CreateCard & { id: string }) => Promise<void>;
  onDiscard: (id: string) => void;
  onWorkOffline: () => Promise<boolean>;
}) {
  const title = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const id = useRef<string>(undefined);
  const [error, setError] = useState('');
  const [canWorkOffline, setCanWorkOffline] = useState(false);

  useEffect(() => { title.current?.focus(); }, []);
  useEffect(() => {
    if (offline && canWorkOffline) onClose();
  }, [offline, canWorkOffline, onClose]);

  async function save(closeIfBlank = false) {
    if (pending || saving.current || (closeIfBlank && error)) return;
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
      id.current ??= crypto.randomUUID();
      await onSave({ ...parsed.data, id: id.current });
      onClose();
    } catch (error) {
      const connectionError = isConnectionError(error);
      setCanWorkOffline(connectionError);
      setError(connectionError ? 'Could not reach the server. Your card is saved on this device.'
        : error instanceof Error ? error.message : 'Unable to create this card.');
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
          readOnly={pending || canWorkOffline}
          onChange={() => setError('')}
          onBlur={() => void save(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !event.nativeEvent.isComposing && !pending && !saving.current) {
              event.preventDefault();
              if (id.current) onDiscard(id.current);
              onClose();
            }
          }}
        />
        {pending && <span className={styles.status} role="status">Saving…</span>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {canWorkOffline && (
          <div className={styles.actions}>
            <button type="button" disabled={pending} onClick={() => void save()}>Retry</button>
            <button type="button" disabled={pending} onClick={async () => {
              if (await onWorkOffline()) onClose();
            }}>Keep editing offline</button>
          </div>
        )}
      </form>
    </CardSurface>
  );
}
