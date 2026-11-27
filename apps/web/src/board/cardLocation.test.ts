import { describe, expect, it } from 'vitest';
import { cardUrl, readCardId } from './useCardLocation';

describe('card links', () => {
  const id = '15dc6da6-cab0-45c7-97ab-dc22c2214c72';

  it('preserves the board address and adds a readable title', () => {
    const url = cardUrl('https://board.example/demo/?view=board#activity', { id, title: 'Harden concurrent card moves!' });

    expect(url.href).toBe(`https://board.example/demo/?view=board&cardId=${id}&slug=harden-concurrent-card-moves#activity`);
    expect(readCardId(url)).toBe(id);
  });

  it('uses the UUID independently of duplicate or renamed titles', () => {
    const sameTitle = new URL(`https://board.example/?cardId=753e682e-1752-4dce-87b8-128b3638e398&slug=harden`);
    const oldTitle = new URL(`https://board.example/?cardId=${id}&slug=harden`);
    const newTitle = cardUrl(oldTitle.href, { id, title: 'Réview card moves' });

    expect(readCardId(sameTitle)).not.toBe(id);
    expect(readCardId(oldTitle)).toBe(id);
    expect(readCardId(newTitle)).toBe(id);
    expect(newTitle.searchParams.get('slug')).toBe('review-card-moves');
    expect(readCardId(cardUrl(newTitle.href, { id }))).toBe(id);
  });

  it('clears the card without changing the other parameters or fragment', () => {
    const url = cardUrl('https://board.example/?keep=1&cardId=&cardId=old&slug=old&keep=2#activity');

    expect(url.href).toBe('https://board.example/?keep=1&keep=2#activity');
    expect(readCardId(url)).toBeUndefined();
  });
});
