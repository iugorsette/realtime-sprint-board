import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './BoardDialog.module.css';

export function BoardDialog({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const heading = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={heading} onCancel={(event) => {
      event.preventDefault();
      onClose();
    }}>
      <header className={styles.header}>
        <h2 id={heading}>{title}</h2>
        <button type="button" className={styles.close} aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
