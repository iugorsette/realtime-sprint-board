import { useEffect, useId, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import { cardUrl } from '../../board/useCardLocation';
import styles from './CardDialog.module.css';

export function CardShare({ cardId, savedTitle }: { cardId: string; savedTitle?: string }) {
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState<{ link: string }>();
  const input = useRef<HTMLInputElement>(null);
  const status = useId();
  const available = savedTitle !== undefined;

  useEffect(() => {
    if (!manualCopy) return;
    input.current?.focus();
    input.current?.select();
  }, [manualCopy]);

  async function copyLink() {
    const link = cardUrl(window.location.href, { id: cardId, title: savedTitle }).href;
    setCopied(false);
    try {
      await navigator.clipboard.writeText(link);
      setManualCopy(undefined);
      setCopied(true);
    } catch {
      setManualCopy({ link });
    }
  }

  return (
    <div className={styles.share}>
      <button type="button" className={styles.secondary} disabled={!available}
        aria-describedby={available ? undefined : status} onClick={() => void copyLink()}>
        <Link2 size={15} aria-hidden="true" /> Copy link
      </button>
      <span id={status} role="status">{!available ? 'Available after sync.' : copied ? 'Link copied.' : manualCopy ? 'Copy the selected card link.' : ''}</span>
      {manualCopy && <input ref={input} aria-label="Card link" value={manualCopy.link} readOnly />}
    </div>
  );
}
