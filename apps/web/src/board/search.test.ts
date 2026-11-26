import { expect, it } from 'vitest';
import { first } from './fixtures';
import { cardSearchRank, normalizeSearch } from './search';

it('ranks title matches before description matches and ignores case and accents', () => {
  const query = normalizeSearch('  CafÉ   Notes ');
  expect(query).toBe('cafe notes');
  expect(cardSearchRank({ ...first, title: 'Café Notes' }, query)).toBe(0);
  expect(cardSearchRank({ ...first, title: 'Cafe Notes Follow-up' }, query)).toBe(1);
  expect(cardSearchRank({ ...first, title: 'Notes for the café' }, query)).toBe(2);
  expect(cardSearchRank({ ...first, description: 'Café notes' }, query)).toBe(3);
  expect(cardSearchRank(first, query)).toBe(Infinity);
});
