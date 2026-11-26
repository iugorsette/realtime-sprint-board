import { Plus } from 'lucide-react';
import { tagTone } from '../../styles/tagTone';
import { SelectionPicker, type PickerOption } from '../SelectionPicker/SelectionPicker';

export function TagPicker({ label, options, value, onChange, allowCreate = false, compact }: {
  label: string;
  options: string[];
  value: string[];
  onChange: (tags: string[]) => void;
  allowCreate?: boolean;
  compact?: boolean;
}) {
  function getOptions(query: string): PickerOption[] {
    const normalized = query.trim().toLowerCase();
    const matching = options.filter((tag) => !value.includes(tag) && tag.includes(normalized));
    const exact = matching.indexOf(normalized);
    if (exact > 0) matching.unshift(...matching.splice(exact, 1));
    const choices: PickerOption[] = matching.map((tag) => ({ id: tag, label: tag }));
    if (allowCreate && normalized && !value.includes(normalized) && !options.includes(normalized)) {
      choices.push({ id: normalized, label: `Create tag “${normalized}”`, icon: <Plus size={13} /> });
    }
    return choices;
  }

  return (
    <SelectionPicker
      label={label} itemName="tag" placeholder={allowCreate ? 'Add a tag…' : 'Filter by tag…'}
      inline={allowCreate} compact={compact} maxLength={30} limitReached={allowCreate && value.length >= 10}
      selected={value.map((tag) => ({ id: tag, label: tag, tone: tagTone(tag) }))}
      getOptions={getOptions}
      onSelect={(tag) => onChange([...value, tag])}
      onRemove={(tag) => onChange(value.filter((item) => item !== tag))}
    />
  );
}
