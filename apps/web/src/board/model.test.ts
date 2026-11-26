import { expect, it } from 'vitest';
import { board, first, second, third } from './fixtures';
import { filterColumns, patchCards, previewMove, reconcileChanges } from './model';
import { keyboardSlot, moveTarget } from './drag';

it('combines search, assignee, priority and tag filters while preserving card references', () => {
  const filtered = filterColumns(board.columns, { search: '  EXPIRED ', assignee: 'maya', priorities: ['URGENT', 'MEDIUM'], tags: ['backend', 'docs'] });
  expect(filtered.map(({ cards }) => cards)).toEqual([[first], []]);
  expect(filtered[0].cards[0]).toBe(first);
  expect(filterColumns(board.columns, { search: '', assignee: 'unassigned', priorities: [], tags: [] })[0].cards).toEqual([second]);
  expect(filterColumns(board.columns, { search: '', assignee: '', priorities: [], tags: [] })[0]).toBe(board.columns[0]);
});

it('patches moves and deletes without replacing untouched columns', () => {
  const moved = previewMove(board, first, { targetColumnId: 'done', beforeCardId: third.id, expectedVersion: 1 });
  expect(moved.columns.map(({ cards }) => cards.map(({ id }) => id))).toEqual([['b'], ['a', 'c']]);
  expect(patchCards(board, [], [second.id]).columns[1]).toBe(board.columns[1]);
  expect(previewMove(board, first, { targetColumnId: 'done', beforeCardId: 'unknown', expectedVersion: 1 })).toBe(board);
});

it('reconciles out-of-order events, ignores stale revisions, and detects gaps', () => {
  const removal = { boardId: board.id, revision: 2, cards: [], deletedCardIds: [first.id] };
  const update = { boardId: board.id, revision: 3, cards: [{ ...second, title: 'Updated' }], deletedCardIds: [] };
  expect(reconcileChanges(board, [update, removal, removal]).board).toMatchObject({
    revision: 3, columns: [{ cards: [{ id: second.id, title: 'Updated' }] }, { cards: [third] }],
  });
  expect(reconcileChanges(board, [update])).toEqual({ board, remaining: [update] });
});

it('moves with arrow keys in and across columns and treats the current slot as a no-op', () => {
  const start = { columnId: 'todo', beforeCardId: first.id };
  const afterLast = { columnId: 'todo', beforeCardId: null };
  expect(keyboardSlot(board.columns, first.id, start, 'ArrowDown')).toEqual(afterLast);
  expect(keyboardSlot(board.columns, first.id, afterLast, 'ArrowUp')).toEqual(start);
  expect(keyboardSlot(board.columns, first.id, start, 'ArrowLeft')).toBeUndefined();
  expect(keyboardSlot(board.columns, first.id, start, 'ArrowRight')).toEqual({ columnId: 'done', beforeCardId: third.id });
  expect(keyboardSlot(board.columns.map((column) => column.id === 'done' ? { ...column, cards: [] } : column),
    first.id, start, 'ArrowRight')).toEqual({ columnId: 'done', beforeCardId: null });
  expect(moveTarget(board.columns, first.id, { columnId: 'todo', beforeCardId: second.id })).toBeUndefined();
  expect(moveTarget(board.columns, first.id, afterLast)).toEqual(afterLast);
});
