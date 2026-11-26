import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import styles from './CardDialog.module.css';

export function InlineText({ label, value, empty, multiline = false, disabled, onSave }: {
  label: string;
  value: string;
  empty?: string;
  multiline?: boolean;
  disabled: boolean;
  onSave: (value: string, previous: string) => void;
}) {
  const [draft, setDraft] = useState<{ value: string; previous: string }>();
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const restoreFocus = useRef(false);
  const editing = Boolean(draft);

  useEffect(() => {
    if (editing) input.current?.focus();
    else if (restoreFocus.current) trigger.current?.focus({ preventScroll: true });
    restoreFocus.current = false;
  }, [editing]);

  function finish(save: boolean, focus = false) {
    if (!draft) return;
    restoreFocus.current = focus;
    setDraft(undefined);
    const next = draft.value.trim();
    if (save && (multiline || next) && next !== draft.previous) onSave(next, draft.previous);
  }

  function keyDown(event: KeyboardEvent) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish(false, true);
    } else if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      finish(true, true);
    }
  }

  if (!draft) {
    return (
      <button ref={trigger} type="button" className={styles.inlineTrigger} aria-label={`Edit ${label.toLowerCase()}`}
        aria-description={multiline && value ? value : undefined}
        disabled={disabled} onClick={() => setDraft({ value, previous: value })}>
        <span className={value ? undefined : styles.empty}>{value || empty}</span>
      </button>
    );
  }

  const props = {
    className: styles.textEditor,
    'aria-label': label,
    value: draft.value,
    onBlur: () => finish(true),
    onKeyDown: keyDown,
  };
  return multiline ? (
    <textarea {...props} rows={5} maxLength={2000} ref={(element) => { input.current = element; }}
      onChange={(event) => setDraft({ ...draft, value: event.target.value })} />
  ) : (
    <input {...props} maxLength={120} ref={(element) => { input.current = element; }}
      onChange={(event) => setDraft({ ...draft, value: event.target.value })} />
  );
}
