import type { Ref } from 'react';
import { Ellipsis, Plus } from 'lucide-react';
import styles from './BoardActions.module.css';

export function AddTask({ columnName, disabled, onClick }: {
  columnName: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.addTask} aria-label={`Add task to ${columnName}`} disabled={disabled} onClick={onClick}>
      <Plus size={15} aria-hidden="true" /> Add task
    </button>
  );
}

export function AddGroup({ buttonRef, disabled, onClick }: {
  buttonRef?: Ref<HTMLButtonElement>;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.addGroup} ref={buttonRef} aria-haspopup="dialog" disabled={disabled} onClick={onClick}>
      <Plus size={15} aria-hidden="true" /> Add group
    </button>
  );
}

export function GroupSettings({ className, columnName, disabled, onClick }: {
  className: string;
  columnName: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const label = `Edit column ${columnName}`;
  return (
    <button type="button" className={`${styles.settings} ${className}`} aria-label={label} title={label}
      aria-haspopup="dialog" disabled={disabled} onClick={onClick}><Ellipsis size={16} aria-hidden="true" /></button>
  );
}
