import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { boardNameSchema, type BoardSummary } from '@board/shared';
import { BoardDialog } from '../components/BoardDialog/BoardDialog';
import { deleteBoard, errorMessage, renameBoard } from './api';
import styles from './Workspace.module.css';

export function BoardSettings({ board, onClose, onSaved, onRefresh }: {
  board: BoardSummary;
  onClose: () => void;
  onSaved: (action: 'rename' | 'delete') => void;
  onRefresh: () => void;
}) {
  const [name, setName] = useState(board.name);
  const [confirming, setConfirming] = useState(false);
  const parsed = boardNameSchema.safeParse(name);
  const change = useMutation({
    mutationFn: (action: 'rename' | 'delete') => action === 'delete'
      ? deleteBoard(board.id, board.name)
      : renameBoard(board.id, { name: boardNameSchema.parse(name), expectedName: board.name }),
    onSuccess: (_, action) => onSaved(action),
    onSettled: onRefresh,
  });
  const canSave = parsed.success && parsed.data !== board.name && !change.isPending;
  const error = change.error && <p role="alert" className={styles.error}>{errorMessage(change.error)}</p>;

  return (
    <BoardDialog title={confirming ? 'Delete board' : 'Board settings'} onClose={() => { if (!change.isPending) onClose(); }}>
      {confirming ? (
        <div className={styles.form}>
          <p className={styles.deleteMessage}>Permanently delete “{board.name}” and all its cards and columns? Everyone will lose access.</p>
          {error}
          <div className={styles.actions}>
            <button type="button" autoFocus disabled={change.isPending} onClick={() => { change.reset(); setConfirming(false); }}>Cancel</button>
            <button type="button" className={styles.danger} disabled={change.isPending} onClick={() => change.mutate('delete')}>Confirm deletion</button>
          </div>
        </div>
      ) : (
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); if (canSave) change.mutate('rename'); }}>
          <label>Board name<input required maxLength={80} autoFocus value={name} disabled={change.isPending}
            onChange={(event) => setName(event.target.value)} /></label>
          {error}
          <div className={styles.actions}>
            <button type="button" className={styles.danger} disabled={change.isPending}
              onClick={() => { change.reset(); setConfirming(true); }}>Delete board</button>
            <button type="submit" className={styles.primary} disabled={!canSave}>Save name</button>
          </div>
        </form>
      )}
    </BoardDialog>
  );
}
