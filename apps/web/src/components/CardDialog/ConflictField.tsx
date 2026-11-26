import { useMemo } from 'react';
import type { TextChange } from '../../board/offline';
import { compareText } from '../../board/textDiff';
import styles from './CardDialog.module.css';

export type ResolveConflict = (change: TextChange, choice: 'mine' | 'server', reviewed?: string) => Promise<void>;

export function ConflictField({ change, server, disabled, onResolve }: {
  change: TextChange;
  server?: string;
  disabled: boolean;
  onResolve: ResolveConflict;
}) {
  const diff = useMemo(() => compareText(change.value, server ?? ''), [change.value, server]);
  return (
    <div className={styles.comparison} role="group" aria-label={`${change.field} conflict`}>
      <div className={styles.version} data-version="draft">
        <h4>Your draft</h4>
        <p>{server === undefined ? change.value || 'Empty' : diff.local.map(({ text, changed }, index) =>
          changed ? <mark key={index}>{text}</mark> : text)}{server !== undefined && !change.value && 'Empty'}</p>
        <button type="button" className={styles.applyDraft} disabled={disabled} onClick={() =>
          void onResolve(change, server === undefined ? 'server' : 'mine', server)}>
          {server === undefined ? 'Discard draft' : 'Apply my draft'}
        </button>
      </div>
      {server !== undefined && (
        <div className={styles.version} data-version="server">
          <h4>Server version</h4>
          <p>{diff.remote.map(({ text, changed }, index) =>
            changed ? <mark key={index}>{text}</mark> : text)}{!server && 'Empty'}</p>
          <button type="button" className={styles.secondary} disabled={disabled}
            onClick={() => void onResolve(change, 'server', server)}>Keep server version</button>
        </div>
      )}
    </div>
  );
}
