import { useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, pointerWithin,
  useDraggable, useDroppable, useSensor, useSensors,
  type Announcements, type KeyboardCoordinateGetter, type ScreenReaderInstructions,
} from '@dnd-kit/core';
import { Check, Circle, CircleDot, Columns3, LoaderCircle, Plus } from 'lucide-react';
import type { Assignee, Card, Column, MoveCard } from '@board/shared';
import { keyboardSlot, moveTarget, slotId, type Slot } from '../../board/drag';
import { CardSurface, CardTile, priorityNames } from '../CardTile/CardTile';
import styles from './BoardGrid.module.css';

const icons = { backlog: Columns3, todo: Circle, 'in-progress': CircleDot, done: Check } as const;
const instructions: ScreenReaderInstructions = {
  draggable: 'Press Enter to open the card. Press Space to pick it up, then use the arrow keys to move. Press Space or Enter to drop, or Escape to cancel.',
};

const readSlot = (data: { current?: { slot?: Slot } } | undefined) => data?.current?.slot;

function DragCard({ card, assignees, onOpen, pending, pendingSync }: {
  card: Card;
  assignees: Map<string, Assignee>;
  onOpen: (card: Card) => void;
  pending: boolean;
  pendingSync: boolean;
}) {
  const slot = { columnId: card.columnId, beforeCardId: card.id };
  const drop = useDroppable({ id: slotId(slot), data: { slot } });
  const drag = useDraggable({ id: card.id, disabled: pending, data: { card, slot } });
  const tooltipId = useId();
  const priorityId = `${tooltipId}-priority`;
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const describedBy = [priorityId, drag.attributes['aria-describedby'], pendingSync && tooltipId].filter(Boolean).join(' ');
  return (
    <li ref={drop.setNodeRef} className={styles.slot} data-over={drop.isOver && !drag.isDragging || undefined}>
      <CardSurface ref={drag.setNodeRef} className={styles.card} data-dragging={drag.isDragging || undefined}
        data-tooltip-dismissed={tooltipDismissed || undefined} onMouseLeave={() => setTooltipDismissed(false)}>
        <button
          type="button" ref={drag.setActivatorNodeRef} className={styles.openCard}
          {...drag.attributes} {...drag.listeners}
          aria-label={card.title} aria-describedby={describedBy || undefined} aria-disabled={undefined} data-drag-card={card.id}
          onClick={() => onOpen(card)}
          onBlur={() => setTooltipDismissed(false)}
          onKeyDown={(event) => {
            if (pendingSync && event.key === 'Escape') setTooltipDismissed(true);
            if (pending && event.code === 'Space') event.preventDefault();
            else drag.listeners?.onKeyDown?.(event);
          }}
        >
          <CardTile card={card} assignees={assignees} pendingTooltipId={pendingSync ? tooltipId : undefined} />
        </button>
        <span id={priorityId} hidden>{priorityNames[card.priority]} priority</span>
      </CardSurface>
    </li>
  );
}

function ColumnEnd({ columnId, message }: { columnId: string; message?: string }) {
  const slot = { columnId, beforeCardId: null };
  const { isOver, setNodeRef } = useDroppable({ id: slotId(slot), data: { slot } });
  return <li ref={setNodeRef} className={styles.end} data-over={isOver || undefined} aria-hidden={message ? undefined : true}>{message && <span>{message}</span>}</li>;
}

function focusHandle(ref: RefObject<HTMLDivElement | null>, cardId: string) {
  requestAnimationFrame(() => {
    const handle = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[data-drag-card]') ?? [])
      .find((element) => element.dataset.dragCard === cardId);
    if (handle && !handle.disabled) handle.focus({ preventScroll: true });
  });
}

export function BoardGrid({ columns, columnTotals, assignees, pending, dragDisabled, pendingCards, onOpen, onCreate, onMove, draft }: {
  columns: Column[];
  columnTotals: ReadonlyMap<string, number>;
  draft?: { columnId: string; content: ReactNode };
  assignees: Map<string, Assignee>;
  pending: boolean;
  dragDisabled: boolean;
  pendingCards: ReadonlySet<string>;
  onOpen: (card: Card) => void;
  onCreate: (columnId: string) => void;
  onMove: (card: Card, input: MoveCard) => Promise<void>;
}) {
  const [activeCard, setActiveCard] = useState<Card>();
  const grid = useRef<HTMLDivElement>(null);
  const columnName = (id: string) => columns.find((column) => column.id === id)?.name ?? 'column';

  const coordinates: KeyboardCoordinateGetter = (event, { context }) => {
    if (!event.code.startsWith('Arrow') || !context.active || !context.collisionRect) return;
    event.preventDefault();
    const current = readSlot(context.over?.data) ?? readSlot(context.active.data);
    if (!current) return;
    const next = keyboardSlot(columns, String(context.active.id), current, event.code);
    const rectangle = next && context.droppableRects.get(slotId(next));
    if (!rectangle) return;
    const active = context.collisionRect;
    const x = rectangle.left + rectangle.width / 2 - active.width / 2;
    const y = rectangle.top + rectangle.height / 2 - active.height / 2;
    return { x, y };
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: coordinates,
      scrollBehavior: 'auto',
      keyboardCodes: { start: ['Space'], end: ['Space', 'Enter'], cancel: ['Escape'] },
    }),
  );
  const announcements: Announcements = {
    onDragStart({ active }) { return `Picked up ${active.data.current?.card.title}.`; },
    onDragOver({ over }) {
      const slot = readSlot(over?.data);
      if (!slot) return 'Outside the board.';
      const card = columns.find(({ id }) => id === slot.columnId)?.cards.find(({ id }) => id === slot.beforeCardId);
      return card ? `Before ${card.title} in ${columnName(slot.columnId)}.` : `End of ${columnName(slot.columnId)}.`;
    },
    onDragEnd({ active, over }) {
      const target = moveTarget(columns, String(active.id), readSlot(over?.data));
      return target ? `Dropped in ${columnName(target.columnId)}.` : 'Card stayed in its original position.';
    },
    onDragCancel() { return 'Move canceled.'; },
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => args.pointerCoordinates ? pointerWithin(args) : closestCenter(args)}
      accessibility={{ announcements, screenReaderInstructions: instructions, restoreFocus: false }}
      onDragStart={({ active }) => setActiveCard(active.data.current?.card)}
      onDragCancel={({ active }) => {
        setActiveCard(undefined);
        focusHandle(grid, String(active.id));
      }}
      onDragEnd={({ active, over, activatorEvent }) => {
        const card = active.data.current?.card as Card | undefined;
        const target = moveTarget(columns, String(active.id), readSlot(over?.data));
        setActiveCard(undefined);
        const keyboard = activatorEvent instanceof KeyboardEvent;
        if (card && target && !dragDisabled) {
          void onMove(card, {
            targetColumnId: target.columnId, beforeCardId: target.beforeCardId, expectedVersion: card.version,
          }).finally(() => {
            if (keyboard) focusHandle(grid, card.id);
          });
        } else if (keyboard) focusHandle(grid, String(active.id));
      }}
    >
      <div ref={grid} className={styles.grid}>
        {columns.map((column) => {
          const Icon = icons[column.id as keyof typeof icons] ?? LoaderCircle;
          const visibleCount = column.cards.length;
          const totalCount = columnTotals.get(column.id) ?? visibleCount;
          const filtered = visibleCount !== totalCount;
          const emptyMessage = visibleCount || draft?.columnId === column.id
            ? undefined
            : filtered ? 'No matching cards' : 'No cards yet';
          return (
            <section key={column.id} className={styles.column} data-column={column.id} aria-labelledby={`column-${column.id}`}>
              <div className={styles.header}>
                <span className={styles.columnIcon}><Icon size={15} aria-hidden="true" /></span>
                <h2 id={`column-${column.id}`}>{column.name}</h2>
                <span className={styles.count} aria-label={filtered ? `${visibleCount} of ${totalCount} cards` : `${totalCount} cards`}>
                  {filtered ? `${visibleCount}/${totalCount}` : totalCount}
                </span>
                <button type="button" onClick={() => onCreate(column.id)} className={styles.add}
                  aria-label={`Add card to ${column.name}`} disabled={pending || Boolean(draft)}><Plus size={17} aria-hidden="true" /></button>
              </div>
              <ul className={styles.cards}>
                {column.cards.map((card) => (
                  <DragCard key={card.id} card={card} assignees={assignees}
                    onOpen={onOpen} pending={pending || dragDisabled || pendingCards.has(card.id)} pendingSync={pendingCards.has(card.id)} />
                ))}
                {draft?.columnId === column.id && <li className={styles.slot}>{draft.content}</li>}
                <ColumnEnd columnId={column.id} message={emptyMessage} />
              </ul>
            </section>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeCard && (
          <CardSurface className={styles.overlay} aria-hidden="true">
            <CardTile card={activeCard} assignees={assignees} />
          </CardSurface>
        )}
      </DragOverlay>
    </DndContext>
  );
}
