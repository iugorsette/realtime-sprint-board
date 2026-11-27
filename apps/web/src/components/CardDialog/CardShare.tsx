import { useEffect, useId, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import { cardUrl } from '../../board/useCardLocation';
import styles from './CardDialog.module.css';

export function CardShare({ cardId, savedTitle }: { cardId: string; savedTitle?: string }) {
  const [feedback, setFeedback] = useState<{ state: 'copied' | 'dismissed' }>();
  const [manualCopy, setManualCopy] = useState<{ link: string }>();
  const input = useRef<HTMLInputElement>(null);
  const status = useId();
  const available = savedTitle !== undefined;
  const copied = feedback?.state === 'copied';

  useEffect(() => {
    if (feedback?.state !== 'copied') return;
    const timeout = window.setTimeout(() => setFeedback({ state: 'dismissed' }), 1600);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!manualCopy) return;
    input.current?.focus();
    input.current?.select();
  }, [manualCopy]);

  async function copyLink() {
    const link = cardUrl(window.location.href, { id: cardId, title: savedTitle }).href;
    try {
      await navigator.clipboard.writeText(link);
      setManualCopy(undefined);
      setFeedback({ state: 'copied' });
    } catch {
      setFeedback(undefined);
      setManualCopy({ link });
    }
  }

  function showHint() {
    if (feedback?.state === 'dismissed') setFeedback(undefined);
  }

  return (
    <div className={styles.share} data-feedback={manualCopy ? 'manual' : feedback?.state} onPointerEnter={showHint}>
      <button type="button" className={styles.icon} disabled={!available} aria-label="Copy link"
        aria-describedby={available ? undefined : status} onFocus={showHint} onClick={() => void copyLink()}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || manualCopy || feedback?.state === 'dismissed') return;
          if (!copied && !event.currentTarget.matches(':hover, :focus-visible')) return;
          event.preventDefault();
          setFeedback({ state: 'dismissed' });
        }}>
        <Link2 size={18} aria-hidden="true" />
      </button>
      <span className={styles.shareTooltip} aria-hidden="true">
        {!available ? 'Available after sync.' : copied ? 'Copied!' : 'Copy link'}
      </span>
      <span id={status} className={styles.shareStatus} role="status">
        {!available ? 'Available after sync.' : copied ? 'Copied!' : manualCopy ? 'Copy the selected card link.' : ''}
      </span>
      {manualCopy && <input ref={input} aria-label="Card link" value={manualCopy.link} readOnly />}
    </div>
  );
}
