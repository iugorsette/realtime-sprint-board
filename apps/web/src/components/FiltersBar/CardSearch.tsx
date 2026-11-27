import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowUpRight, Search, UserRound, X } from 'lucide-react';
import type { Assignee, Card, Column } from '@board/shared';
import { cardSearchRank, normalizeSearch } from '../../board/search';
import { searchAssignees } from '../AssigneePicker/searchAssignees';
import { Avatar } from '../CardTile/CardTile';
import styles from './FiltersBar.module.css';

export function CardSearch({ value, columns, assignees, selectedAssignee, onChange, onOpen, onAssignee }: {
  value: string;
  columns: Column[];
  assignees: Assignee[];
  selectedAssignee: string;
  onChange: (value: string) => void;
  onOpen: (card: Card) => void;
  onAssignee: (id: string) => void;
}) {
  const list = useId();
  const panel = useId();
  const input = useRef<HTMLInputElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const query = normalizeSearch(value);
  const results = useMemo(() => !query ? [] : columns
    .flatMap((column) => column.cards.map((card) => ({ card, column: column.name, rank: cardSearchRank(card, query) })))
    .sort((a, b) => a.rank - b.rank).slice(0, 5), [columns, query]);
  const people = useMemo(() => query ? searchAssignees(assignees, [selectedAssignee], query).slice(0, 4) : [],
    [assignees, query, selectedAssignee]);
  const count = results.length + people.length;
  const open = focused && Boolean(query);

  const focusSearch = useCallback(() => {
    // Reveal the field before focusing it inside the tap that opens the keyboard.
    if (toggle.current?.getClientRects().length) flushSync(() => setMobileOpen(true));
    input.current?.focus();
    input.current?.select();
    setFocused(true);
  }, []);

  function closeMobileSearch() {
    setMobileOpen(false);
    setFocused(false);
    setActive(-1);
    toggle.current?.focus();
  }

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'k'
        || event.defaultPrevented || event.isComposing || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      focusSearch();
    }
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [focusSearch]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${list}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, list, open]);

  function choose(index: number) {
    const card = results[index]?.card;
    const person = people[index - results.length];
    if (mobileOpen && toggle.current?.getClientRects().length) closeMobileSearch();
    if (card) onOpen(card);
    if (person) onAssignee(person.id);
    setFocused(false);
    setActive(-1);
  }

  return (
    <div className={styles.searchArea} data-mobile-open={mobileOpen || undefined} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        if (event.relatedTarget) setMobileOpen(false);
        setFocused(false);
        setActive(-1);
      }
    }}>
      <button ref={toggle} type="button" className={styles.searchToggle}
        aria-label={query ? 'Search cards, filter active' : 'Search cards'} data-active={Boolean(query) || undefined}
        aria-expanded={mobileOpen} aria-controls={panel}
        onClick={() => mobileOpen ? closeMobileSearch() : focusSearch()}>
        <Search size={19} aria-hidden="true" />
      </button>
      <div id={panel} className={styles.searchPanel}>
        <div className={styles.searchFields}>
          <div className={styles.search}>
            <Search size={17} aria-hidden="true" />
            <input ref={input} type="search" role="combobox" placeholder="Search cards…" aria-label="Search cards"
              aria-keyshortcuts="Control+K Meta+K" aria-expanded={open} aria-autocomplete="list"
              aria-controls={open ? list : undefined}
              aria-activedescendant={open && active >= 0 && active < count ? `${list}-${active}` : undefined}
              autoComplete="off" value={value}
              onFocus={() => setFocused(true)}
              onClick={() => setFocused(true)}
              onChange={(event) => {
                onChange(event.target.value);
                setActive(-1);
                setFocused(true);
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                const mobileSearch = mobileOpen && toggle.current?.getClientRects().length;
                if (event.key === 'Escape' && mobileSearch) {
                  event.preventDefault();
                  closeMobileSearch();
                } else if (event.key === 'Escape' && open) {
                  event.preventDefault();
                  setFocused(false);
                  setActive(-1);
                } else if (query && count && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                  event.preventDefault();
                  setFocused(true);
                  const next = event.key === 'ArrowDown' ? active + 1 : active < 0 ? count - 1 : active - 1;
                  setActive((next + count) % count);
                } else if (event.key === 'Enter' && open && count) {
                  event.preventDefault();
                  choose(active >= 0 && active < count ? active : 0);
                } else if (event.key === 'Enter' && mobileSearch) closeMobileSearch();
              }} />
            {value ? (
              <button type="button" className={styles.searchClear} aria-label="Clear search" onClick={() => {
                onChange('');
                setActive(-1);
                input.current?.focus();
              }}><X size={15} aria-hidden="true" /></button>
            ) : <kbd className={styles.shortcut}>Ctrl K</kbd>}
          </div>
          <button type="button" className={styles.finishSearch} onClick={closeMobileSearch}>Done</button>
        </div>
        {open && (
          <div id={list} role="listbox" className={styles.searchResults} aria-label="Search suggestions">
            {results.length > 0 && (
              <div role="group" aria-label="Cards">
                <span className={styles.groupLabel} aria-hidden="true">Cards</span>
                {results.map(({ card, column }, index) => (
                  <div key={card.id} id={`${list}-${index}`} role="option" aria-selected={active === index}
                    className={styles.result} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
                    <span><strong>{card.title}</strong><small>{column}</small></span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </div>
                ))}
              </div>
            )}
            {people.length > 0 && (
              <div role="group" aria-label="Filter by assignee">
                <span className={styles.groupLabel} aria-hidden="true"><UserRound size={13} /> Filter by assignee</span>
                {people.map((person, index) => (
                  <div key={person.id} id={`${list}-${results.length + index}`} role="option"
                    aria-label={`Filter by ${person.name}`} aria-selected={active === results.length + index}
                    className={`${styles.result} ${styles.personResult}`}
                    onMouseDown={(event) => event.preventDefault()} onClick={() => choose(results.length + index)}>
                    <Avatar person={person} /> <span>{person.name}</span>
                  </div>
                ))}
              </div>
            )}
            {count === 0 && <div role="presentation" className={styles.empty}>No matching cards or assignees</div>}
          </div>
        )}
      </div>
    </div>
  );
}
