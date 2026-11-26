import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import styles from './SelectionPicker.module.css';

export interface PickerOption {
  id: string;
  label: string;
  icon?: ReactNode;
  tone?: number;
}

export function SelectionPicker({
  label, itemName, placeholder, selected, getOptions, onSelect, onRemove,
  inline = false, compact = false, maxLength, limitReached = false,
}: {
  label: string;
  itemName: string;
  placeholder: string;
  selected: PickerOption[];
  getOptions: (query: string) => PickerOption[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  inline?: boolean;
  compact?: boolean;
  maxLength?: number;
  limitReached?: boolean;
}) {
  const list = useId();
  const input = useRef<HTMLInputElement>(null);
  const add = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [activeId, setActiveId] = useState<string>();
  const open = expanded && !limitReached;
  const choices = open ? getOptions(query) : [];
  const active = choices.findIndex(({ id }) => id === activeId);

  useEffect(() => {
    if (editing) input.current?.focus({ preventScroll: true });
  }, [editing]);

  function select(id: string) {
    onSelect(id);
    setQuery('');
    close();
  }

  function close() {
    setExpanded(false);
    setActiveId(undefined);
  }

  const chips = selected.length > 0 && (
    <ul className={styles.chips} aria-label={`Selected ${itemName}s`}>
      {selected.map(({ id, label, icon, tone }) => (
        <li key={id}>
          <button type="button" data-tag-tone={tone} aria-label={`Remove ${itemName} ${label}`} onClick={() => {
            (input.current ?? add.current)?.focus({ preventScroll: true });
            onRemove(id);
            close();
          }}>
            {icon && <span className={styles.optionIcon} aria-hidden="true">{icon}</span>}
            {label}<X size={12} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={styles.picker} data-inline={inline || undefined} data-compact={compact || undefined}
      onBlur={(event) => {
        if (compact && !event.currentTarget.contains(event.relatedTarget)) {
          setEditing(false);
          setQuery('');
        }
      }}>
      {!compact && chips}
      {compact && !editing ? (
        <button ref={add} type="button" className={styles.add} disabled={limitReached} onClick={() => setEditing(true)}>
          <Plus size={14} aria-hidden="true" /> Add {itemName}
        </button>
      ) : <input
        ref={input}
        className={styles.input}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? list : undefined}
        aria-activedescendant={open && active >= 0 ? `${list}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        maxLength={maxLength}
        value={query}
        readOnly={limitReached}
        onFocus={() => setExpanded(true)}
        onClick={() => setExpanded(true)}
        onBlur={close}
        onChange={(event) => {
          setQuery(event.target.value);
          setExpanded(true);
          setActiveId(undefined);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape' && open) {
            event.stopPropagation();
            event.preventDefault();
            close();
          } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !limitReached) {
            event.preventDefault();
            setExpanded(true);
            const navigable = open ? choices : getOptions(query);
            if (!navigable.length) return;
            const next = event.key === 'ArrowDown' ? active + 1 : active < 0 ? navigable.length - 1 : active - 1;
            setActiveId(navigable[(next + navigable.length) % navigable.length].id);
          } else if (event.key === 'Enter' && (active >= 0 || query.trim())) {
            event.preventDefault();
            const choice = choices[active] ?? choices[0];
            if (choice) select(choice.id);
          }
        }}
      />}
      {compact && chips}
      {open && (
        <ul id={list} role="listbox" aria-label={`${label} suggestions`} className={styles.options}>
          {choices.length === 0 && <li role="presentation" className={styles.empty}>No matching {itemName}s</li>}
          {choices.map(({ id, label, icon }, index) => (
            <li key={id} id={`${list}-${index}`} role="option" aria-selected={index === active}
              ref={index === active ? (element) => element?.scrollIntoView({ block: 'nearest' }) : undefined}
              onMouseDown={(event) => event.preventDefault()} onClick={() => select(id)}>
              {icon && <span className={styles.optionIcon} aria-hidden="true">{icon}</span>}
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
