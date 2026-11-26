import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import styles from './TagPicker.module.css';

export function TagPicker({ label, options, value, onChange, allowCreate = false }: {
  label: string;
  options: string[];
  value: string[];
  onChange: (tags: string[]) => void;
  allowCreate?: boolean;
}) {
  const list = useId();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const normalized = query.trim().toLowerCase();
  const hasRoom = !allowCreate || value.length < 10;
  const choices = options.filter((tag) => !value.includes(tag) && tag.includes(normalized))
    .map((tag) => ({ tag, create: false }));
  if (allowCreate && normalized && !value.includes(normalized) && !options.includes(normalized)) {
    choices.push({ tag: normalized, create: true });
  }
  const open = focused && hasRoom;
  const highlighted = choices[active];

  function select(tag: string) {
    onChange([...value, tag]);
    setQuery('');
    setActive(-1);
  }

  return (
    <div className={styles.picker} data-inline={allowCreate || undefined}>
      {value.length > 0 && (
        <ul className={styles.chips} aria-label="Selected tags">
          {value.map((tag) => (
            <li key={tag}>
              <button type="button" onClick={() => onChange(value.filter((item) => item !== tag))}
                aria-label={`Remove tag ${tag}`}>{tag}<X size={12} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
      <input
        className={styles.input}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? list : undefined}
        aria-activedescendant={open && highlighted ? `${list}-${active}` : undefined}
        autoComplete="off"
        placeholder={allowCreate ? 'Add a tag…' : 'Filter by tag…'}
        maxLength={30}
        value={query}
        readOnly={!hasRoom}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setActive(-1); }}
        onChange={(event) => {
          setQuery(event.target.value);
          setFocused(true);
          setActive(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation();
            event.preventDefault();
            setFocused(false);
            setActive(-1);
          } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && hasRoom) {
            event.preventDefault();
            setFocused(true);
            if (!choices.length) return;
            const last = choices.length - 1;
            const next = event.key === 'ArrowDown' ? active + 1 : active - 1;
            setActive(next < 0 ? last : next % choices.length);
          } else if (event.key === 'Enter' && open && (normalized || highlighted)) {
            event.preventDefault();
            const choice = highlighted ?? choices.find(({ tag }) => tag === normalized) ?? choices[0];
            if (choice) select(choice.tag);
          }
        }}
      />
      {open && (
        <ul id={list} role="listbox" aria-label={`${label} suggestions`} className={styles.options}>
          {choices.length === 0 && <li role="presentation" className={styles.empty}>No matching tags</li>}
          {choices.map(({ tag, create }, index) => (
            <li key={tag} id={`${list}-${index}`} role="option" aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()} onClick={() => select(tag)}>
              {create && <Plus size={13} aria-hidden="true" />}
              {create ? `Create tag “${tag}”` : tag}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
