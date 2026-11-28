import { memo, useId, useState, type ReactNode, type Ref } from 'react';
import type { Assignee, Card, Column } from '@board/shared';
import { AddGroup, AddTask, GroupSettings } from '../BoardActions/BoardActions';
import { CardSurface, CardTile, priorityNames } from '../CardTile/CardTile';
import styles from './CardList.module.css';

const CardRow = memo(function CardRow({ card, assignees, pending, onOpen }: {
  card: Card;
  assignees: ReadonlyMap<string, Assignee>;
  pending: boolean;
  onOpen: (card: Card) => void;
}) {
  const detailsId = useId();
  const pendingId = `${detailsId}-pending`;
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const people = card.assigneeIds.flatMap((id) => assignees.get(id)?.name ?? []);
  const description = [
    `${priorityNames[card.priority]} priority`,
    people.length ? `Assigned to ${people.join(', ')}` : 'Unassigned',
    card.tags.length ? `Tags: ${card.tags.join(', ')}` : '',
  ].filter(Boolean).join('. ');

  return (
    <li>
      <CardSurface className={styles.row} data-tooltip-dismissed={tooltipDismissed || undefined}
        onMouseLeave={() => setTooltipDismissed(false)}>
        <button type="button" className={styles.open} aria-label={card.title} aria-haspopup="dialog"
          aria-describedby={pending ? `${detailsId} ${pendingId}` : detailsId} onClick={() => onOpen(card)}
          onBlur={() => setTooltipDismissed(false)} onKeyDown={(event) => {
            if (pending && event.key === 'Escape') setTooltipDismissed(true);
          }}>
          <CardTile card={card} assignees={assignees} pendingTooltipId={pending ? pendingId : undefined} layout="list" />
        </button>
        <span id={detailsId} hidden>{description}</span>
      </CardSurface>
    </li>
  );
});

export function CardList({ columns, columnTotals, assignees, pending, pendingCards, onOpen, onCreate, draft,
  onEditColumn, onAddGroup, addGroupButton, columnControlsDisabled }: {
  columns: Column[];
  columnTotals: ReadonlyMap<string, number>;
  assignees: ReadonlyMap<string, Assignee>;
  pending: boolean;
  pendingCards: ReadonlySet<string>;
  onOpen: (card: Card) => void;
  onCreate?: (columnId: string) => void;
  onEditColumn?: (column: Column) => void;
  onAddGroup?: () => void;
  addGroupButton: Ref<HTMLButtonElement>;
  columnControlsDisabled: boolean;
  draft?: { columnId: string; content: ReactNode };
}) {
  const headingId = useId();
  const addDisabled = pending || Boolean(draft);
  return (
    <div className={styles.list}>
      {columns.map((column) => {
        const shown = column.cards.length;
        const total = columnTotals.get(column.id) ?? shown;
        const filtered = shown !== total;
        const activeDraft = draft?.columnId === column.id ? draft.content : undefined;
        const heading = `${headingId}-${column.id}`;
        const addTask = onCreate && (() => onCreate(column.id));
        return (
          <section key={column.id} className={styles.section} data-column-color={column.color} aria-labelledby={heading}>
            <div className={styles.heading}>
              <span className={styles.status} aria-hidden="true" />
              <h2 id={heading}>{column.name}</h2>
              <span className={styles.count} aria-label={filtered ? `${shown} of ${total} cards` : `${total} cards`}>
                {filtered ? `${shown}/${total}` : total}
              </span>
              {onEditColumn && <GroupSettings className={styles.groupSettings} columnName={column.name}
                disabled={columnControlsDisabled} onClick={() => onEditColumn(column)} />}
            </div>
            {shown > 0 || activeDraft ? (
              <ul className={styles.rows}>
                {column.cards.map((card) => <CardRow key={card.id} card={card} assignees={assignees}
                  onOpen={onOpen} pending={pendingCards.has(card.id)} />)}
                {activeDraft && <li className={styles.draft}>{activeDraft}</li>}
              </ul>
            ) : (filtered || !addTask) && <p className={styles.empty}>{filtered ? 'No matching cards' : 'No cards yet'}</p>}
            {addTask && !activeDraft && <div className={styles.addTask}>
              <AddTask columnName={column.name} disabled={addDisabled} onClick={addTask} />
            </div>}
          </section>
        );
      })}
      {onAddGroup && <div className={styles.newGroup}>
        <AddGroup buttonRef={addGroupButton} disabled={columnControlsDisabled} onClick={onAddGroup} />
      </div>}
    </div>
  );
}
