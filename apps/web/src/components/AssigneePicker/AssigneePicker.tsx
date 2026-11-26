import type { Assignee } from '@board/shared';
import { Avatar } from '../CardTile/CardTile';
import { SelectionPicker, type PickerOption } from '../SelectionPicker/SelectionPicker';
import { searchAssignees } from './searchAssignees';

function option(person: Assignee): PickerOption {
  return { id: person.id, label: person.name, icon: <Avatar person={person} /> };
}

export function AssigneePicker({ assignees, value, onChange, compact }: {
  assignees: Assignee[];
  value: string[];
  compact?: boolean;
  onChange: (assigneeIds: string[]) => void;
}) {
  return (
    <SelectionPicker
      label="Assignees" itemName="assignee" placeholder="Search people…" inline compact={compact}
      selected={assignees.filter(({ id }) => value.includes(id)).map(option)}
      getOptions={(query) => searchAssignees(assignees, value, query).map(option)}
      onSelect={(id) => onChange([...value, id])}
      onRemove={(id) => onChange(value.filter((assigneeId) => assigneeId !== id))}
    />
  );
}
