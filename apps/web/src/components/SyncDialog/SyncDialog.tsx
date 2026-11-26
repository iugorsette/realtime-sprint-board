import type { Board } from '@board/shared';
import { BoardDialog } from '../BoardDialog/BoardDialog';
import styles from './SyncDialog.module.css';

export function SyncDialog({ board, offline, syncing, pendingCount, notice, conflictCount, onWorkOffline,
  onResume, onClose, onReview }: {
  board?: Board;
  offline: boolean;
  syncing: boolean;
  pendingCount: number;
  notice: string;
  conflictCount: number;
  onWorkOffline: () => Promise<boolean>;
  onResume: () => Promise<void>;
  onClose: () => void;
  onReview: () => void;
}) {
  return (
    <BoardDialog title="Board sync" onClose={onClose}>
      {syncing && <p role="status">Syncing changes…</p>}
      {notice && <p role="alert" className={styles.error}>{notice}</p>}
      {offline && <p>Changes stay in this browser until you resume sync.</p>}
      {pendingCount > 0 && <p>{pendingCount} {pendingCount === 1 ? 'change' : 'changes'} pending</p>}
      <div className={styles.actions}>
        {!offline && <button type="button" disabled={syncing || !board} onClick={async () => {
          if (await onWorkOffline()) onClose();
        }}>Work offline</button>}
        {(offline || pendingCount > conflictCount) && (
          <button type="button" disabled={syncing} onClick={() => void onResume()}>Resume sync</button>
        )}
        {conflictCount > 0 && <button type="button" disabled={syncing} onClick={onReview}>Review changes</button>}
      </div>
    </BoardDialog>
  );
}
