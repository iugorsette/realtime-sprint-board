import { memo, type ComponentPropsWithRef } from 'react';
import type { Assignee, Card } from '@board/shared';
import { tagTone } from '../../styles/tagTone';
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
  const people = card.assigneeIds.flatMap((id) => {
    const person = assignees.get(id);
    return person ? [person] : [];
  });
  const morePeople = people.slice(2);
  const [firstTag, ...moreTags] = card.tags;

  return (
    <span className={styles.content}>
      <span className={styles.summary}>
        <span className={styles.title}>{card.title}</span>
        {card.description && <span className={styles.description}>{card.description}</span>}
      </span>
      <span className={styles.meta}>
        <span className={styles.priority} data-priority={card.priority}>
          <span aria-hidden="true" className={styles.priorityDot} />{priorityNames[card.priority]}
        </span>
        {firstTag && (
          <span className={styles.tags}>
            <span className={styles.tag} data-tag-tone={tagTone(firstTag)} title={firstTag}>{firstTag}</span>
            {moreTags.length > 0 && <span className={styles.moreTags} title={moreTags.join(', ')}>+{moreTags.length}</span>}
          </span>
        )}
        {people.length > 0 && (
          <span className={styles.avatars}>
            {people.slice(0, 2).map((person) => <Avatar key={person.id} person={person} />)}
            {morePeople.length > 0 && (
              <span className={styles.morePeople} title={morePeople.map(({ name }) => name).join(', ')}>+{morePeople.length}</span>
            )}
          </span>
        )}
      </span>
    </span>
  );
});
