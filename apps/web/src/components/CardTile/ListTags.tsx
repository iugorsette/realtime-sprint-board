import { useLayoutEffect, useRef, useState } from 'react';
import { tagTone } from '../../styles/tagTone';
import styles from './CardTile.module.css';

export function ListTags({ tags }: { tags: readonly string[] }) {
  const track = useRef<HTMLSpanElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const viewport = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState({ count: tags.length, counterStart: 0 });

  useLayoutEffect(() => {
    const row = track.current;
    const container = viewport.current;
    const measure = counter.current;
    if (!row || !container || !measure) return;

    const update = () => {
      const available = container.getBoundingClientRect().width;
      const bounds = row.getBoundingClientRect();
      let count = tags.length;
      let counterStart = 0;
      if (bounds.width > available) {
        const gap = Number.parseFloat(getComputedStyle(row).columnGap);
        const counterWidth = measure.getBoundingClientRect().width;
        count = 0;
        for (const chip of row.children) {
          const end = chip.getBoundingClientRect().right - bounds.left;
          if (end + gap + counterWidth > available) break;
          count += 1;
          counterStart = end + gap;
        }
      }
      setFit((current) => current.count === count && current.counterStart === counterStart ? current : { count, counterStart });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(row);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [tags]);

  const hidden = tags.slice(fit.count);
  return (
    <span ref={viewport} className={styles.listTags}>
      <span ref={track} className={`${styles.tags} ${styles.tagTrack}`}>
        {tags.map((tag, index) => (
          <span key={tag} className={styles.tag} data-tag-tone={tagTone(tag)} title={tag}
            data-overflow={index >= fit.count || undefined}>{tag}</span>
        ))}
      </span>
      {/* With at least one chip visible, the counter is at most one digit (ten tags per card). */}
      <span ref={counter} className={`${styles.moreTags} ${styles.tagCounter}`} aria-hidden="true">+9</span>
      {hidden.length > 0 && <span className={`${styles.moreTags} ${styles.tagOverflow}`} title={hidden.join(', ')}
        style={{ insetInlineStart: fit.counterStart }}>+{hidden.length}</span>}
    </span>
  );
}
