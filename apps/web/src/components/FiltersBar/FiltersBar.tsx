import { useState } from 'react';
import { Flag, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { prioritySchema, type Assignee, type Card, type Column } from '@board/shared';
import type { Filters } from '../../board/model';
import { Avatar, priorityNames } from '../CardTile/CardTile';
import { BoardDialog } from '../BoardDialog/BoardDialog';
import { ChoiceMenu } from '../ChoiceMenu/ChoiceMenu';
import { TagPicker } from '../TagPicker/TagPicker';
import { CardSearch } from './CardSearch';
import styles from './FiltersBar.module.css';

export const emptyFilters: Filters = { search: '', assignee: '', priorities: [], tags: [] };

export function FiltersBar({ filters, onChange, assignees, tags, columns, filtersInDialog, onOpenCard }: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  assignees: Assignee[];
  tags: string[];
  columns: Column[];
  filtersInDialog: boolean;
  onOpenCard: (card: Card) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const assignee = assignees.find(({ id }) => id === filters.assignee);
  const count = Number(Boolean(filters.assignee)) + filters.priorities.length + filters.tags.length;
  const assigneeLabel = assignee?.name ?? (filters.assignee === 'unassigned' ? 'Unassigned' : 'Assignee');
  function clearFilters() { onChange({ ...emptyFilters, search: filters.search }); }
  const controls = (
    <>
      <ChoiceMenu label="Filter by assignee" selected={[filters.assignee]}
        trigger={<>{assignee ? <Avatar person={assignee} /> : <UserRound size={15} aria-hidden="true" />}<span>{assigneeLabel}</span></>}
        options={[
          { value: '', label: 'All assignees' },
          { value: 'unassigned', label: 'Unassigned', icon: <UserRound size={15} aria-hidden="true" /> },
          ...assignees.map((person) => ({ value: person.id, label: person.name, icon: <Avatar person={person} /> })),
        ]}
        onSelect={(id) => onChange({ ...filters, assignee: id })} />
      <ChoiceMenu label="Filter by priority" selected={filters.priorities} multiple
        trigger={<><Flag size={15} aria-hidden="true" /><span>Priority{filters.priorities.length ? ` (${filters.priorities.length})` : ''}</span></>}
        options={prioritySchema.options.map((value) => ({ value, label: priorityNames[value], priority: value }))}
        onSelect={(priority) => onChange({
          ...filters,
          priorities: filters.priorities.includes(priority)
            ? filters.priorities.filter((item) => item !== priority)
            : [...filters.priorities, priority],
        })} />
      <TagPicker label="Filter by tag" options={tags} value={filters.tags}
        onChange={(tags) => onChange({ ...filters, tags })} />
    </>
  );
  return (
    <div className={styles.bar} role="group" aria-label="Board filters">
      <CardSearch value={filters.search} columns={columns} assignees={assignees} selectedAssignee={filters.assignee}
        onChange={(search) => onChange({ ...filters, search })} onOpen={onOpenCard}
        onAssignee={(id) => onChange({ ...filters, search: '', assignee: id })} />
      <button type="button" className={styles.filterButton} data-forced={filtersInDialog || undefined}
        aria-haspopup="dialog" aria-expanded={dialogOpen} onClick={() => setDialogOpen(true)}>
        <SlidersHorizontal size={16} aria-hidden="true" /> Filters
        {count > 0 && <span className={styles.count}>{count}</span>}
      </button>
      {!filtersInDialog && !dialogOpen && <div className={styles.controls}>{controls}</div>}
      {count > 0 && (
        <button type="button" className={styles.clear} onClick={clearFilters}>
          <X size={14} aria-hidden="true" /> Clear filters
        </button>
      )}
      {dialogOpen && (
        <BoardDialog title="Filters" onClose={() => setDialogOpen(false)}>
          <div className={styles.dialogControls}>{controls}</div>
          <footer className={styles.dialogActions}>
            {count > 0 && <button type="button" className={styles.clear} onClick={clearFilters}>
              <X size={14} aria-hidden="true" /> Clear filters
            </button>}
            <button type="button" className={styles.done} onClick={() => setDialogOpen(false)}>Done</button>
          </footer>
        </BoardDialog>
      )}
    </div>
  );
}
