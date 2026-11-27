import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import type { CardEditResult } from '../../board/useCardEdits';
import styles from './CardDialog.module.css';

type Draft = { value: string; previous: string };
type SaveState = { status: 'saving' } | Exclude<CardEditResult, { status: 'saved' }>;

export function InlineText({ label, value, empty, multiline = false, disabled, heading, onSave, onDiscard, onWorkOffline }: {
  label: string;
  value: string;
  empty?: string;
  multiline?: boolean;
  disabled: boolean;
  heading?: RefObject<HTMLHeadingElement | null>;
  onSave: (value: string, previous: string) => Promise<CardEditResult>;
  onDiscard: (value: string) => void;
  onWorkOffline?: () => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Draft>();
  const [saveState, setSaveState] = useState<SaveState>();
  const field = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const restoreFocus = useRef(false);
  const feedbackId = useId();
  const editing = Boolean(draft);
  const saving = saveState?.status === 'saving';

  useEffect(() => {
    if (editing) input.current?.focus();
    else if (restoreFocus.current) trigger.current?.focus({ preventScroll: true });
    restoreFocus.current = false;
  }, [editing]);

  function closeDraft() {
    restoreFocus.current = field.current?.contains(document.activeElement) ?? false;
    setSaveState(undefined);
    setDraft(undefined);
  }

  function discardDraft() {
    if (draft && saveState?.status === 'error' && saveState.offlineAvailable) onDiscard(draft.value.trim());
    closeDraft();
  }

  async function save(previous: string) {
    if (!draft) return;
    const next = draft.value.trim();
    if ((!multiline && !next) || next === previous) {
      closeDraft();
      return;
    }
    setSaveState({ status: 'saving' });
    const result = await onSave(next, previous);
    if (result.status === 'saved') closeDraft();
    else setSaveState(result);
  }

  function keyDown(event: KeyboardEvent) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!saving) discardDraft();
    } else if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (draft && !saveState) void save(draft.previous);
    }
  }

  const textEditorProps = draft && {
    className: styles.textEditor,
    'aria-label': saveState && !saving ? `Your ${label.toLowerCase()} draft` : label,
    'aria-describedby': saveState && !saving ? feedbackId : undefined,
    value: draft.value,
    readOnly: Boolean(saveState),
    onBlur: () => { if (!saveState) void save(draft.previous); },
    onKeyDown: keyDown,
  };
  const control = !draft || !textEditorProps ? (
    <button ref={trigger} type="button" className={styles.inlineTrigger} aria-label={`Edit ${label.toLowerCase()}`}
        aria-description={multiline && value ? value : undefined}
        disabled={disabled} onClick={() => setDraft({ value, previous: value })}>
      <span className={value ? undefined : styles.empty}>{value || empty}</span>
    </button>
  ) : multiline ? (
    <textarea {...textEditorProps} rows={5} maxLength={2000} ref={(element) => { input.current = element; }}
      onChange={(event) => setDraft({ ...draft, value: event.target.value })} />
  ) : (
    <input {...textEditorProps} maxLength={120} ref={(element) => { input.current = element; }}
      onChange={(event) => setDraft({ ...draft, value: event.target.value })} />
  );

  const fieldChanged = draft && value !== draft.previous && value !== draft.value.trim();
  return (
    <div ref={field} className={heading ? styles.titleEditor : undefined}>
      {heading ? <h2 ref={heading} tabIndex={-1} aria-label={value}>{control}</h2> : control}
      {saveState && !saving && (
        <div className={styles.draftFeedback}>
          <p id={feedbackId} role="alert">
            {fieldChanged ? `The saved ${label.toLowerCase()} changed while you were editing. Your draft is still here.`
              : saveState.status === 'error' ? saveState.message : 'The card changed while saving. Try saving your draft again.'}
          </p>
          {fieldChanged && (
            <div>
              <strong>Current {label.toLowerCase()}</strong>
              <p className={styles.currentText}>{value || 'Empty'}</p>
            </div>
          )}
          <div className={styles.draftActions}>
            <button type="button" className={styles.secondary} onClick={discardDraft}>
              {fieldChanged ? 'Keep current' : 'Discard draft'}
            </button>
            <button type="button" className={styles.applyDraft} disabled={disabled}
              onClick={() => {
                input.current?.focus({ preventScroll: true });
                void save(value);
              }}>
              {fieldChanged ? 'Apply my draft' : 'Retry save'}
            </button>
            {onWorkOffline && saveState.status === 'error' && saveState.offlineAvailable && (
              <button type="button" className={styles.secondary} onClick={async () => {
                if (await onWorkOffline()) closeDraft();
              }}>Keep editing offline</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
