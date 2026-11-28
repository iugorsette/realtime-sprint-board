import { memo, useId, useState, type ReactNode } from 'react';
import { Ellipsis, Plus } from 'lucide-react';
import type { Assignee, Card, Column } from '@board/shared';
import { columnTone } from '../../board/model';
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
  onEditColumn, columnControlsDisabled }: {
  columns: Column[];
  columnTotals: ReadonlyMap<string, number>;
  assignees: ReadonlyMap<string, Assignee>;
  pending: boolean;
  pendingCards: ReadonlySet<string>;
  onOpen: (card: Card) => void;
  onCreate: (columnId: string) => void;
  onEditColumn?: (column: Column) => void;
  columnControlsDisabled: boolean;
  draft?: { columnId: string; content: ReactNode };
}) {
  const headingId = useId();
  return (
    <div className={styles.list}>
      {columns.map((column) => {
        const shown = column.cards.length;
        const total = columnTotals.get(column.id) ?? shown;
        const filtered = shown !== total;
        const activeDraft = draft?.columnId === column.id ? draft.content : undefined;
        const heading = `${headingId}-${column.id}`;
        return (
          <section key={column.id} className={styles.section} data-column={columnTone(column)} aria-labelledby={heading}>
            <div className={styles.heading}>
              <span className={styles.status} aria-hidden="true" />
              <h2 id={heading}>{column.name}</h2>
              <span className={styles.count} aria-label={filtered ? `${shown} of ${total} cards` : `${total} cards`}>
                {filtered ? `${shown}/${total}` : total}
              </span>
              <button type="button" className={styles.add} aria-label={`Add card to ${column.name}`}
                disabled={pending || Boolean(draft)} onClick={() => onCreate(column.id)}><Plus size={17} aria-hidden="true" /></button>
              {onEditColumn && <button type="button" className={styles.settings} aria-label={`Edit column ${column.name}`}
                aria-haspopup="dialog" disabled={columnControlsDisabled} onClick={() => onEditColumn(column)}>
                <Ellipsis size={17} aria-hidden="true" />
              </button>}
            </div>
            {shown > 0 || activeDraft ? (
              <ul className={styles.rows}>
                {column.cards.map((card) => <CardRow key={card.id} card={card} assignees={assignees}
                  onOpen={onOpen} pending={pendingCards.has(card.id)} />)}
                {activeDraft && <li className={styles.draft}>{activeDraft}</li>}
              </ul>
            ) : <p className={styles.empty}>{filtered ? 'No matching cards' : 'No cards yet'}</p>}
          </section>
        );
      })}
    </div>
  );
}
