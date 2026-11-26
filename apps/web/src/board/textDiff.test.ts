import { expect, it } from 'vitest';
import { compareText } from './textDiff';

it('highlights separate changes and preserves shared words and line breaks', () => {
  const draft = 'Retry online.\nKeep the draft.';
  const server = 'Retry offline.\nKeep the card.';
  const { local, remote } = compareText(draft, server);

  expect(local.map(({ text }) => text).join('')).toBe(draft);
  expect(remote.map(({ text }) => text).join('')).toBe(server);
  expect(local.filter(({ changed }) => changed).map(({ text }) => text)).toEqual(['online', 'draft']);
  expect(remote.filter(({ changed }) => changed).map(({ text }) => text)).toEqual(['offline', 'card']);
});

it('handles an empty version and preserves Unicode text', () => {
  expect(compareText('', 'Revisão 👋')).toEqual({
    local: [],
    remote: [{ text: 'Revisão 👋', changed: true }],
  });
});
