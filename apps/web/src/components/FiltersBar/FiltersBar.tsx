import { Search, X } from 'lucide-react';
import type { Assignee, Priority } from '@board/shared';
import type { Filters } from '../../board/model';
import { priorityNames } from '../CardTile/CardTile';
import { TagPicker } from '../TagPicker/TagPicker';
import styles from './FiltersBar.module.css';

export const emptyFilters: Filters = { search: '', assignee: '', priorities: [], tags: [] };
const priorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function toggle<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function CheckFilter<T extends string>({ label, options, values, onChange }: {
  label: string;
  options: { id: T; label: string }[];
  values: T[];
  onChange: (values: T[]) => void;
}) {
  return (
    <details className={styles.details}>
      <summary>{label}{values.length > 0 && <span className={styles.badge}>{values.length}</span>}</summary>
      <div className={styles.menu}>
        {options.length === 0 && <span className={styles.empty}>No options</span>}
        {options.map(({ id, label }) => (
          <label key={id}>
            <input type="checkbox" checked={values.includes(id)} onChange={() => onChange(toggle(values, id))} />
            {label}
          </label>
        ))}
      </div>
    </details>
  );
}

export function FiltersBar({ filters, onChange, assignees, tags }: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  assignees: Assignee[];
  tags: string[];
}) {
  const active = filters.search || filters.assignee || filters.priorities.length > 0 || filters.tags.length > 0;
  return (
    <div className={styles.bar} aria-label="Board filters">
      <label className={styles.search}>
        <Search size={16} aria-hidden="true" />
        <input type="search" placeholder="Search cards…" aria-label="Search cards" value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })} />
      </label>
      <select className={styles.assignee} aria-label="Filter by assignee" value={filters.assignee}
        onChange={(event) => onChange({ ...filters, assignee: event.target.value })}>
        <option value="">Assignee</option>
        <option value="unassigned">Unassigned</option>
        {assignees.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
      </select>
      <CheckFilter label="Priority" values={filters.priorities}
        options={priorities.map((id) => ({ id, label: priorityNames[id] }))}
        onChange={(priorities) => onChange({ ...filters, priorities })} />
      <TagPicker label="Filter by tag" options={tags} value={filters.tags}
        onChange={(tags) => onChange({ ...filters, tags })} />
      {active && <button type="button" className={styles.clear} onClick={() => onChange(emptyFilters)}>
        <X size={14} aria-hidden="true" /> Clear
      </button>}
    </div>
  );
}
