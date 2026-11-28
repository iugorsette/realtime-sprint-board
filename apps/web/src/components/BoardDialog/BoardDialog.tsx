import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './BoardDialog.module.css';

export function BoardDialog({ title, onClose, children, placement = 'center' }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  placement?: 'center' | 'left';
}) {
  const heading = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} className={styles.dialog} data-placement={placement} aria-labelledby={heading}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (placement === 'left' && event.target === event.currentTarget &&
          event.clientX >= event.currentTarget.getBoundingClientRect().right) onClose();
      }}>
      <div className={styles.header}>
        <h2 id={heading}>{title}</h2>
        <button type="button" className={styles.close} aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
