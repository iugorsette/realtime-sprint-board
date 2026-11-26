import { memo } from 'react';
import { GripVertical } from 'lucide-react';
import type { Assignee, Card } from '@board/shared';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import styles from './CardTile.module.css';

export const priorityNames = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' } as const;

export function Avatar({ person }: { person: Assignee }) {
  const color = [...person.id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 4;
  return <span className={styles.avatar} data-color={color} title={person.name} aria-label={person.name}>{person.initials}</span>;
}

export const CardTile = memo(function CardTile({ card, assignee, onOpen }: {
  card: Card;
  assignee?: Assignee;
  onOpen?: (card: Card) => void;
}) {
  return (
    <div className={styles.content}>
      <span className={styles.priority} data-priority={card.priority}>
        <span aria-hidden="true" className={styles.priorityDot} />{priorityNames[card.priority]}
      </span>
      {onOpen ? <button type="button" className={styles.title} onClick={() => onOpen(card)}>{card.title}</button>
        : <span className={styles.title}>{card.title}</span>}
      {card.description && <p className={styles.description}>{card.description}</p>}
      <div className={styles.meta}>
        <div className={styles.tags}>
          {card.tags.slice(0, 2).map((tag) => <span key={tag} className={styles.tag}>{tag}</span>)}
          {card.tags.length > 2 && <span className={styles.tag}>+{card.tags.length - 2}</span>}
        </div>
        {assignee && <Avatar person={assignee} />}
      </div>
    </div>
  );
});

export function DragHandle({ card, attributes, listeners, setRef, disabled }: {
  card: Card;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setRef: (element: HTMLButtonElement | null) => void;
  disabled: boolean;
}) {
  return (
    <button
      ref={setRef} type="button" className={styles.handle} {...attributes} {...listeners}
      disabled={disabled} aria-label={`Move ${card.title}`} data-drag-card={card.id}
    >
      <GripVertical aria-hidden="true" size={16} />
    </button>
  );
}
