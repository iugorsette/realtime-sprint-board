import { describe, expect, it } from 'vitest';
import { cardUrl, readCardId } from './useCardLocation';

describe('card links', () => {
  const id = '15dc6da6-cab0-45c7-97ab-dc22c2214c72';

  it('preserves the board address and uses only the private card identifier', () => {
    const url = cardUrl('https://board.example/demo/?boardId=my-board&view=board#activity', { id });

    expect(url.href).toBe(`https://board.example/demo/?boardId=my-board&view=board&cardId=${id}#activity`);
    expect(readCardId(url)).toBe(id);
  });

  it('reads legacy links and removes the old title from new links', () => {
    const sameTitle = new URL(`https://board.example/?cardId=753e682e-1752-4dce-87b8-128b3638e398&slug=harden`);
    const oldTitle = new URL(`https://board.example/?cardId=${id}&slug=harden`);
    const newLink = cardUrl(oldTitle.href, { id });

    expect(readCardId(sameTitle)).not.toBe(id);
    expect(readCardId(oldTitle)).toBe(id);
    expect(readCardId(newLink)).toBe(id);
    expect(newLink.searchParams.has('slug')).toBe(false);
  });

  it('clears the card without changing the other parameters or fragment', () => {
    const url = cardUrl('https://board.example/?keep=1&cardId=&cardId=old&slug=old&keep=2#activity');

    expect(url.href).toBe('https://board.example/?keep=1&keep=2#activity');
    expect(readCardId(url)).toBeUndefined();
  });
});
