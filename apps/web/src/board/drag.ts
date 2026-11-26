import type { Column } from '@board/shared';

export interface Slot {
  columnId: string;
  beforeCardId: string | null;
}

export const slotId = ({ columnId, beforeCardId }: Slot) => JSON.stringify([columnId, beforeCardId]);

export function moveTarget(columns: Column[], cardId: string, slot: Slot | undefined): Slot | undefined {
  if (!slot || slot.beforeCardId === cardId) return;
  const from = columns.find((column) => column.cards.some(({ id }) => id === cardId));
  if (!from || from.id !== slot.columnId) return slot;
  const index = from.cards.findIndex(({ id }) => id === cardId);
  if ((from.cards[index + 1]?.id ?? null) !== slot.beforeCardId) return slot;
}

export function keyboardSlot(columns: Column[], cardId: string, current: Slot, direction: string): Slot | undefined {
  const columnIndex = columns.findIndex(({ id }) => id === current.columnId);
  if (columnIndex < 0) return;
  const column = columns[columnIndex];
  const index = current.beforeCardId === null
    ? column.cards.length
    : column.cards.findIndex(({ id }) => id === current.beforeCardId);
  if (index < 0) return;
  const horizontal = direction === 'ArrowLeft' ? -1 : direction === 'ArrowRight' ? 1 : 0;
  if (horizontal) {
    const neighbor = columns[columnIndex + horizontal];
    if (neighbor) return { columnId: neighbor.id, beforeCardId: neighbor.cards[index]?.id ?? null };
    return;
  }
  const step = direction === 'ArrowUp' ? -1 : direction === 'ArrowDown' ? 1 : 0;
  if (!step) return;
  let next = index + step;
  if (step > 0 && column.cards[index]?.id === cardId) next++;
  if (step < 0 && column.cards[next - 1]?.id === cardId) next--;
  if (next >= 0 && next <= column.cards.length) {
    return { columnId: column.id, beforeCardId: column.cards[next]?.id ?? null };
  }
}
