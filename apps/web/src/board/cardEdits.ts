import type { Card, Priority } from '@board/shared';

type TextField = 'title' | 'description';
type ListField = 'tags' | 'assigneeIds';

export type CardEdit =
  | { field: TextField; value: string; previous: string }
  | { field: 'priority'; value: Priority }
  | { field: 'columnId'; value: string }
  | { field: ListField; value: string; operation: 'add' | 'remove' };

export function applyCardEdit(card: Card, edit: CardEdit): Card {
  if ('operation' in edit) {
    const values = card[edit.field];
    const includesValue = values.includes(edit.value);
    if (includesValue === (edit.operation === 'add')) return card;
    const updated = edit.operation === 'add' ? [...values, edit.value] : values.filter((value) => value !== edit.value);
    return { ...card, [edit.field]: updated };
  }
  if (card[edit.field] === edit.value) return card;
  return { ...card, [edit.field]: edit.value };
}
