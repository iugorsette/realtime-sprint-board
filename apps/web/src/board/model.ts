import {
  calculateMidpointPosition, comparePositions, needsRebalancing, rebalancePositions,
  type Board, type BoardChange, type Card, type Column, type MoveCard, type Priority,
} from '@board/shared';

export interface Filters {
  search: string;
  assignee: string;
  priorities: Priority[];
  tags: string[];
}

export function filterColumns(columns: Column[], filters: Filters) {
  const search = filters.search.trim().toLowerCase();
  return columns.map((column) => {
    const cards = column.cards.filter((card) => {
      const matchesSearch = card.title.toLowerCase().includes(search) || card.description.toLowerCase().includes(search);
      const matchesAssignee = !filters.assignee
        || (filters.assignee === 'unassigned' ? card.assigneeIds.length === 0 : card.assigneeIds.includes(filters.assignee));
      const matchesPriority = !filters.priorities.length || filters.priorities.includes(card.priority);
      const matchesTags = !filters.tags.length || card.tags.some((tag) => filters.tags.includes(tag));
      return matchesSearch && matchesAssignee && matchesPriority && matchesTags;
    });
    return cards.length === column.cards.length ? column : { ...column, cards };
  });
}

export function patchCards(board: Board, cards: Card[], deleted: string[] = []): Board {
  const changedIds = new Set([...cards.map(({ id }) => id), ...deleted]);
  return {
    ...board,
    columns: board.columns.map((column) => {
      const updates = cards.filter(({ columnId }) => columnId === column.id);
      if (!updates.length && !column.cards.some(({ id }) => changedIds.has(id))) return column;
      const unchanged = column.cards.filter(({ id }) => !changedIds.has(id));
      return { ...column, cards: [...unchanged, ...updates].sort(comparePositions) };
    }),
  };
}

export function previewMove(board: Board, card: Card, move: MoveCard) {
  const destination = board.columns.find(({ id }) => id === move.targetColumnId);
  if (!destination) return board;
  const neighbors = destination.cards.filter(({ id }) => id !== card.id);
  const index = move.beforeCardId === null ? neighbors.length : neighbors.findIndex(({ id }) => id === move.beforeCardId);
  if (index < 0) return board;
  const previous = neighbors[index - 1]?.position;
  const next = neighbors[index]?.position;
  const moved = { ...card, columnId: move.targetColumnId };
  if (needsRebalancing(previous, next)) {
    neighbors.splice(index, 0, moved);
    const positions = rebalancePositions(neighbors);
    return patchCards(board, neighbors.map((item, offset) => ({ ...item, position: positions[offset].position })));
  }
  return patchCards(board, [{ ...moved, position: calculateMidpointPosition(previous, next) }]);
}

export function reconcileChanges(board: Board, changes: readonly BoardChange[]) {
  const ordered = changes.filter(({ boardId }) => boardId === board.id).sort((a, b) => a.revision - b.revision);
  for (const [index, change] of ordered.entries()) {
    if (change.revision <= board.revision) continue;
    if (change.revision !== board.revision + 1) return { board, remaining: ordered.slice(index) };
    board = { ...patchCards(board, change.cards, change.deletedCardIds), revision: change.revision };
  }
  return { board, remaining: [] };
}
