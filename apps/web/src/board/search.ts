import type { Card } from '@board/shared';

export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function cardSearchRank(card: Card, query: string): number {
  if (!query) return 0;
  const title = normalizeSearch(card.title);
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  const terms = query.split(' ');
  if (terms.every((term) => title.includes(term))) return 2;
  const text = `${title} ${normalizeSearch(card.description)}`;
  return terms.every((term) => text.includes(term)) ? 3 : Infinity;
}
