import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { columnNameSchema, type Column } from '@board/shared';
import { createColumn, deleteColumn, errorMessage, renameColumn } from '../../workspace/api';
import { BoardDialog } from '../BoardDialog/BoardDialog';
import styles from './ColumnDialog.module.css';

export function ColumnDialog({ boardId, column, deleteBlocked, onClose, onSaved, onRefresh }: {
  boardId: string;
  column?: Pick<Column, 'id' | 'name'>;
  deleteBlocked?: string;
  onClose: () => void;
  onSaved: (action: 'save' | 'delete') => void;
  onRefresh: () => void;
}) {
  const [name, setName] = useState(column?.name ?? '');
  const [confirming, setConfirming] = useState(false);
  const parsed = columnNameSchema.safeParse(name);
  const change = useMutation({
    mutationFn: async (action: 'save' | 'delete') => {
      if (action === 'delete' && column) return deleteColumn(boardId, column.id, column.name);
      const value = columnNameSchema.parse(name);
      return column
        ? renameColumn(boardId, column.id, { name: value, expectedName: column.name })
        : createColumn(boardId, { name: value });
    },
    onSuccess: (_, action) => onSaved(action),
    onSettled: onRefresh,
  });
  const close = () => { if (!change.isPending) onClose(); };
  const error = change.error && <p className={styles.error} role="alert">{errorMessage(change.error)}</p>;

  return (
    <BoardDialog title={column ? 'Column settings' : 'Add column'} onClose={close}>
      {confirming && column ? (
        <div className={styles.form}>
          <p>Delete the empty column “{column.name}”?</p>
          {deleteBlocked && <p role="status">{deleteBlocked}</p>}
          {error}
          <div className={styles.actions}>
            <button type="button" autoFocus disabled={change.isPending} onClick={() => { setConfirming(false); change.reset(); }}>Cancel</button>
            <button type="button" className={styles.danger} disabled={change.isPending || Boolean(deleteBlocked)}
              onClick={() => change.mutate('delete')}>Confirm deletion</button>
          </div>
        </div>
      ) : (
        <form className={styles.form} onSubmit={(event) => {
          event.preventDefault();
          if (parsed.success && !change.isPending && parsed.data !== column?.name) change.mutate('save');
        }}>
          <label>Column name<input required maxLength={80} autoFocus value={name} disabled={change.isPending}
            onChange={(event) => setName(event.target.value)} /></label>
          {deleteBlocked && <p>{deleteBlocked}</p>}
          {error}
          <div className={styles.actions}>
            {column && <button type="button" className={styles.danger} disabled={change.isPending || Boolean(deleteBlocked)}
              onClick={() => { change.reset(); setConfirming(true); }}>Delete column</button>}
            <button type="submit" className={styles.primary}
              disabled={change.isPending || !parsed.success || parsed.data === column?.name}>
              {column ? 'Save name' : 'Create column'}
            </button>
          </div>
        </form>
      )}
    </BoardDialog>
  );
}
