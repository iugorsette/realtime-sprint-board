import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { columnColorSchema, columnNameSchema, type Column, type ColumnColor } from '@board/shared';
import { createColumn, deleteColumn, errorMessage, updateColumn } from '../../workspace/api';
import { BoardDialog } from '../BoardDialog/BoardDialog';
import styles from './ColumnDialog.module.css';

const colorNames: Record<ColumnColor, string> = {
  GRAY: 'Gray', RED: 'Red', AMBER: 'Amber', GREEN: 'Green',
  TEAL: 'Teal', BLUE: 'Blue', PURPLE: 'Purple', PINK: 'Pink',
};

export function ColumnDialog({ boardId, column, deleteBlocked, onClose, onSaved, onRefresh }: {
  boardId: string;
  column?: Pick<Column, 'id' | 'name' | 'color'>;
  deleteBlocked?: string;
  onClose: () => void;
  onSaved: (action: 'save' | 'delete') => void;
  onRefresh: () => void;
}) {
  const [name, setName] = useState(column?.name ?? '');
  const [color, setColor] = useState<ColumnColor>(column?.color ?? 'GRAY');
  const [confirming, setConfirming] = useState(false);
  const parsed = columnNameSchema.safeParse(name);
  const change = useMutation({
    mutationFn: async (action: 'save' | 'delete') => {
      if (action === 'delete' && column) return deleteColumn(boardId, column.id, column.name);
      const value = columnNameSchema.parse(name);
      return column
        ? updateColumn(boardId, column.id, { name: value, color, expectedName: column.name, expectedColor: column.color })
        : createColumn(boardId, { name: value, color });
    },
    onSuccess: (_, action) => onSaved(action),
    onSettled: onRefresh,
  });
  const close = () => { if (!change.isPending) onClose(); };
  const error = change.error && <p className={styles.error} role="alert">{errorMessage(change.error)}</p>;
  const canSave = parsed.success && !change.isPending && (parsed.data !== column?.name || color !== column?.color);

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
          if (canSave) change.mutate('save');
        }}>
          <label>Column name<input required maxLength={80} autoFocus value={name} disabled={change.isPending}
            onChange={(event) => setName(event.target.value)} /></label>
          <fieldset className={styles.palette} disabled={change.isPending}>
            <legend>Column color</legend>
            <div className={styles.colors}>
              {columnColorSchema.options.map((option) => (
                <label className={styles.colorChoice} key={option} data-column-color={option}>
                  <input type="radio" name="column-color" value={option} checked={color === option}
                    onChange={() => setColor(option)} />
                  <span className={styles.swatch} aria-hidden="true"><Check size={16} strokeWidth={2.5} /></span>
                  <span>{colorNames[option]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {deleteBlocked && <p>{deleteBlocked}</p>}
          {error}
          <div className={styles.actions}>
            {column && <button type="button" className={styles.danger} disabled={change.isPending || Boolean(deleteBlocked)}
              onClick={() => { change.reset(); setConfirming(true); }}>Delete column</button>}
            <button type="submit" className={styles.primary} disabled={!canSave}>
              {column ? 'Save changes' : 'Create column'}
            </button>
          </div>
        </form>
      )}
    </BoardDialog>
  );
}
