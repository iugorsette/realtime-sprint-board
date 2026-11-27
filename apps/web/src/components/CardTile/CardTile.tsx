import { memo, type ComponentPropsWithRef } from 'react';
import { ArrowDown, ArrowUp, ChevronsUp, Minus, TriangleAlert } from 'lucide-react';
import type { Assignee, Card } from '@board/shared';
import { tagTone } from '../../styles/tagTone';
import { FittingTags } from './FittingTags';
import styles from './CardTile.module.css';

export const priorityNames = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' } as const;
const priorityIcons = { LOW: ArrowDown, MEDIUM: Minus, HIGH: ArrowUp, URGENT: ChevronsUp } as const;

export function CardSurface({ className, ...props }: ComponentPropsWithRef<'article'>) {
  return <article {...props} className={className ? `${styles.surface} ${className}` : styles.surface} />;
}

export function Avatar({ person }: { person: Assignee }) {
  const color = [...person.id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 4;
  return <span className={styles.avatar} data-color={color} title={person.name} aria-label={person.name}>{person.initials}</span>;
}

export const CardTile = memo(function CardTile({ card, assignees, pendingTooltipId, layout = 'board' }: {
  card: Card;
  assignees: ReadonlyMap<string, Assignee>;
  pendingTooltipId?: string;
  layout?: 'board' | 'list';
}) {
  const people = card.assigneeIds.flatMap((id) => {
    const person = assignees.get(id);
    return person ? [person] : [];
  });
  const visiblePeople = people.length <= 3 ? people : people.slice(0, 2);
  const morePeople = people.slice(visiblePeople.length);
  const [firstTag] = card.tags;
  const PriorityIcon = priorityIcons[card.priority];

  return (
    <span className={styles.content} data-layout={layout}>
      <span className={styles.summary}>
        <span className={styles.title}>{card.title}</span>
        {card.description && <span className={styles.description}>{card.description}</span>}
      </span>
      <span className={styles.meta}>
        <span className={styles.priority} data-priority={card.priority}>
          <span aria-hidden="true" className={styles.priorityDot} />
          <span className={styles.priorityLabel}>{priorityNames[card.priority]}</span>
          {layout === 'list' && <PriorityIcon className={styles.priorityIcon} size={17} strokeWidth={2.5} aria-hidden="true" />}
        </span>
        {pendingTooltipId && (
          <span className={styles.pendingSync}>
            <TriangleAlert size={13} aria-hidden="true" />
            <span id={pendingTooltipId} role="tooltip" className={styles.syncTooltip}>Pending sync</span>
          </span>
        )}
        {card.tags.length > 1 ? <FittingTags tags={card.tags} /> : firstTag && (
          <span className={styles.tag} data-tag-tone={tagTone(firstTag)} title={firstTag}>{firstTag}</span>
        )}
        {people.length > 0 && (
          <span className={styles.avatars}>
            {visiblePeople.map((person) => <Avatar key={person.id} person={person} />)}
            {morePeople.length > 0 && (
              <span className={styles.morePeople} title={morePeople.map(({ name }) => name).join(', ')}>+{morePeople.length}</span>
            )}
          </span>
        )}
      </span>
    </span>
  );
});
