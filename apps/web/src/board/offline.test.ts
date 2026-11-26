import { afterEach, expect, it, vi } from 'vitest';
import { board, first } from './fixtures';
import { findCard, projectPending, sendPending, textDisposition, type Creation, type TextChange } from './offline';

const text: TextChange = {
  kind: 'text', key: 'a:description', token: 'edit-1', original: first,
  field: 'description', previous: first.description, value: 'A local description',
};

afterEach(() => vi.unstubAllGlobals());

it('projects new cards and their pending text without altering the committed snapshot', () => {
  const id = '8343cc21-1afe-4859-9f85-3568c7c30216';
  const input = { id, columnId: 'todo', title: 'Local card', description: '', priority: 'MEDIUM' as const, tags: [], assigneeIds: [] };
  const creation: Creation = { kind: 'create', key: id, input };
  const pending = projectPending(board, [creation]);
  const original = findCard(pending, id)!;
  const draft = { ...text, original, previous: '', key: id + ':description' };

  expect(findCard(projectPending(board, [creation, draft]), id)).toMatchObject({ description: text.value, position: 3072 });
  expect(findCard(board, id)).toBeUndefined();
  expect(findCard(projectPending(pending, [creation]), id)).toEqual(original);
});

it('distinguishes already committed, conflicting, and deleted edits', () => {
  expect(textDisposition(text, { ...first, description: text.value })).toBe('applied');
  expect(textDisposition(text, { ...first, description: 'Remote edit' })).toBe('conflict');
  expect(textDisposition(text, undefined)).toBe('deleted');
  expect(textDisposition(text, { ...first, priority: 'LOW', version: 3 })).toBe('send');
});

it('replays against the current server version and preserves unrelated remote changes', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ change: null }));
  vi.stubGlobal('fetch', fetchMock);
  const latest = projectPending(board, [{
    ...text, key: 'a:title', field: 'title', previous: first.title, value: 'Remote title',
  }]);
  await sendPending(latest, text);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
    title: 'Remote title', description: text.value, expectedVersion: first.version,
  });

  const conflicted = projectPending(board, [{ ...text, value: 'New remote description' }]);
  await sendPending(conflicted, text, 'Older reviewed description');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
