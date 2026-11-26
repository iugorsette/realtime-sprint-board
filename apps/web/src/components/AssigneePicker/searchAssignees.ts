import type { Assignee } from '@board/shared';

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function searchAssignees(assignees: Assignee[], selected: string[], query: string) {
  const available = assignees.filter(({ id }) => !selected.includes(id));
  const terms = normalize(query);
  if (!terms.length) return available;

  const phrase = terms.join(' ');
  const initials = terms.join('');
  return available.flatMap((person) => {
    const names = normalize(person.name);
    const matchesInitials = normalize(person.initials).join('').startsWith(initials);
    if (names.join(' ') === phrase) return [{ person, rank: 0 }];
    if (matchesInitials || terms.every((term) => names.some((name) => name.startsWith(term)))) {
      return [{ person, rank: 1 }];
    }
    if (terms.every((term) => names.some((name) => name.includes(term)))) {
      return [{ person, rank: 2 }];
    }
    return [];
  }).sort((a, b) => a.rank - b.rank).map(({ person }) => person);
}
