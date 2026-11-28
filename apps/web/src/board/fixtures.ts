import type { Board, Card } from '@board/shared';

export const first: Card = {
  id: 'a', columnId: 'todo', position: 1024, version: 1, title: 'Fix the race',
  description: 'Retry expired requests', priority: 'URGENT', assigneeIds: ['maya', 'sam'], tags: ['backend'],
};
export const second: Card = {
  id: 'b', columnId: 'todo', position: 2048, version: 1, title: 'Document setup',
  description: '', priority: 'LOW', assigneeIds: [], tags: ['docs'],
};
export const third: Card = {
  id: 'c', columnId: 'done', position: 1024, version: 1, title: 'Polish layout',
  description: '', priority: 'MEDIUM', assigneeIds: ['maya', 'sam'], tags: ['frontend'],
};
export const board: Board = {
  id: 'test', name: 'Test', revision: 1, assignees: [],
  columns: [
    { id: 'todo', name: 'Todo', color: 'AMBER', position: 0, cards: [first, second] },
    { id: 'done', name: 'Done', color: 'GREEN', position: 1, cards: [third] },
  ],
};
