import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { ColumnColor } from '@board/shared';
import styles from './ChoiceMenu.module.css';

export interface Choice<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  priority?: string;
  columnColor?: ColumnColor;
}

export function ChoiceMenu<T extends string>({ label, trigger, options, selected, onSelect, multiple = false, disabled = false }: {
  label: string;
  trigger: ReactNode;
  options: readonly Choice<T>[];
  selected: readonly T[];
  onSelect: (value: T) => void;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const panel = list.current;
    (panel?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ?? panel?.querySelector<HTMLButtonElement>('button'))?.focus({ preventScroll: true });

    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  function close() {
    setOpen(false);
    button.current?.focus({ preventScroll: true });
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    if (!items.length) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div ref={root} className={styles.menu} onKeyDown={navigate} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button ref={button} type="button" className={styles.trigger} disabled={disabled}
        aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)} onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setOpen(true);
          }
        }}>
        <span className={styles.triggerContent}>{trigger}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div ref={list} className={styles.options} id={id} role="listbox" aria-label={label}
          aria-multiselectable={multiple || undefined}>
          {options.map(({ value, label: optionLabel, icon, priority, columnColor }) => (
            <button key={value} type="button" role="option" tabIndex={-1}
              aria-selected={selected.includes(value)} className={styles.option}
              data-priority={priority} data-column-color={columnColor} onClick={() => {
                onSelect(value);
                if (!multiple) close();
              }}>
              {icon}
              <span>{optionLabel}</span>
              {selected.includes(value) && <Check className={styles.check} size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
