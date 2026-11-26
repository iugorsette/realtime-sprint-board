import { expect, it } from 'vitest';
import { searchAssignees } from './searchAssignees';

const people = [
  { id: 'mariana', name: 'Mariana Costa', initials: 'MC' },
  { id: 'ines', name: 'Inês João', initials: 'IJ' },
  { id: 'ana-silva', name: 'Ana Silva', initials: 'AS' },
  { id: 'ana', name: 'Ana', initials: 'A' },
];

it('finds accented names, reordered name fragments and spaced initials', () => {
  expect(searchAssignees(people, [], '  jo in   ')).toEqual([people[1]]);
  expect(searchAssignees(people, [], 'INES')).toEqual([people[1]]);
  expect(searchAssignees(people, [], 'i j')).toEqual([people[1]]);
});

it('ranks exact names before prefixes and substrings and excludes selected people', () => {
  expect(searchAssignees(people, [], 'ana')).toEqual([people[3], people[2], people[0]]);
  expect(searchAssignees(people, ['ana-silva'], 'ana')).toEqual([people[3], people[0]]);
  expect(searchAssignees(people, ['ines'], '').map(({ id }) => id)).toEqual(['mariana', 'ana-silva', 'ana']);
  expect(searchAssignees(people, [], 'unknown')).toEqual([]);
});
