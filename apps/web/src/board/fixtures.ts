import type { Board, Card } from '@board/shared';

export const first: Card = {
  id: 'a', columnId: 'todo', position: 1024, version: 1, title: 'Fix the race',
  description: 'Retry expired requests', priority: 'URGENT', assigneeId: 'maya', tags: ['backend'],
};
export const second: Card = {
  id: 'b', columnId: 'todo', position: 2048, version: 1, title: 'Document setup',
  description: '', priority: 'LOW', assigneeId: null, tags: ['docs'],
};
export const third: Card = {
  id: 'c', columnId: 'done', position: 1024, version: 1, title: 'Polish layout',
  description: '', priority: 'MEDIUM', assigneeId: 'maya', tags: ['frontend'],
};
export const board: Board = {
  id: 'test', name: 'Test', revision: 1, assignees: [],
  columns: [
    { id: 'todo', name: 'Todo', position: 0, cards: [first, second] },
    { id: 'done', name: 'Done', position: 1, cards: [third] },
  ],
};
