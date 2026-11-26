import { memo, type ComponentPropsWithRef } from 'react';
import type { Assignee, Card } from '@board/shared';
import styles from './CardTile.module.css';

export const priorityNames = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' } as const;

export function CardSurface({ className, ...props }: ComponentPropsWithRef<'article'>) {
  return <article {...props} className={className ? `${styles.surface} ${className}` : styles.surface} />;
}

export function Avatar({ person }: { person: Assignee }) {
  const color = [...person.id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 4;
  return <span className={styles.avatar} data-color={color} title={person.name} aria-label={person.name}>{person.initials}</span>;
}

export const CardTile = memo(function CardTile({ card, assignees }: {
  card: Card;
  assignees: Map<string, Assignee>;
}) {
  return (
    <span className={styles.content}>
      <span className={styles.priority} data-priority={card.priority}>
        <span aria-hidden="true" className={styles.priorityDot} />{priorityNames[card.priority]}
      </span>
      <span className={styles.title}>{card.title}</span>
      {card.description && <span className={styles.description}>{card.description}</span>}
      <span className={styles.meta}>
        <span className={styles.tags}>
          {card.tags.slice(0, 2).map((tag) => <span key={tag} className={styles.tag}>{tag}</span>)}
          {card.tags.length > 2 && <span className={styles.tag}>+{card.tags.length - 2}</span>}
        </span>
        <span className={styles.avatars}>
          {card.assigneeIds.map((id) => {
            const person = assignees.get(id);
            return person && <Avatar key={id} person={person} />;
          })}
        </span>
      </span>
    </span>
  );
});
