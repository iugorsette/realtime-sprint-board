import { useCallback, useMemo, useState } from 'react';
import { Columns3, Plus, Radio, X } from 'lucide-react';
import { DEMO_BOARD_ID, type Card, type MoveCard } from '@board/shared';
import { useBoard } from './board/useBoard';
import { filterColumns } from './board/model';
import { Avatar } from './components/CardTile/CardTile';
import { BoardGrid } from './components/BoardGrid/BoardGrid';
import { CardDialog, type Editor } from './components/CardDialog/CardDialog';
import { emptyFilters, FiltersBar } from './components/FiltersBar/FiltersBar';
import styles from './App.module.css';

const connectionLabels = { connecting: 'Connecting', live: 'Live sync', offline: 'Sync offline' };

export function App() {
  const { query, mutation, connection, retry } = useBoard(DEMO_BOARD_ID);
  const { data: board } = query;
  const [filters, setFilters] = useState(emptyFilters);
  const [editor, setEditor] = useState<Editor>();
  const [notice, setNotice] = useState('');
  const open = useCallback((card: Card) => setEditor({ columnId: card.columnId, card }), []);
  const create = useCallback((columnId: string) => setEditor({ columnId }), []);
  const close = useCallback(() => setEditor(undefined), []);
  const columns = useMemo(() => board ? filterColumns(board.columns, filters) : [], [board, filters]);
  const assignees = useMemo(() => new Map(board?.assignees.map((person) => [person.id, person])), [board?.assignees]);
  const tags = useMemo(() => [...new Set(board?.columns.flatMap((column) => column.cards.flatMap((card) => card.tags)))].sort(), [board?.columns]);

  async function move(card: Card, input: MoveCard) {
    setNotice('');
    try {
      await mutation.mutateAsync({ type: 'move', id: card.id, input });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to move this card.');
    }
  }

  const firstColumn = board?.columns[0];
  const total = board?.columns.reduce((sum, column) => sum + column.cards.length, 0) ?? 0;
  const done = board?.columns.find(({ id }) => id === 'done')?.cards.length ?? 0;
  const shown = columns.reduce((sum, column) => sum + column.cards.length, 0);

  return (
    <>
      <header className={styles.top}>
        <div className={styles.topInner}>
          <span className={styles.brand}><span className={styles.logo}><Columns3 size={18} aria-hidden="true" /></span> Sprint Board</span>
          <div className={styles.topRight}>
            <span className={styles.connection} data-connection={connection} role="status">
              <Radio size={15} aria-hidden="true" /> {connectionLabels[connection]}
            </span>
            {board && (
              <div className={styles.people} aria-label="Board assignees">
                {board.assignees.map((person) => <Avatar key={person.id} person={person} />)}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.heading}>
          <div>
            <h1>{board?.name ?? 'Sprint Board'}</h1>
          </div>
          {firstColumn && (
            <button className={styles.primary} type="button" disabled={mutation.isPending}
              onClick={() => create(firstColumn.id)}><Plus size={17} aria-hidden="true" /> New card</button>
          )}
        </div>
        {board ? (
          <>
            <div className={styles.toolbar}>
              <FiltersBar filters={filters} onChange={setFilters} assignees={board.assignees} tags={tags} />
              <div className={styles.metrics}>
                <span>{shown !== total ? `${shown} of ${total} cards` : `${total} ${total === 1 ? 'card' : 'cards'}`}</span>
                <span className={styles.progress}><progress max={total || 1} value={done} aria-label="Completed cards" />{done} done</span>
              </div>
            </div>
            <BoardGrid columns={columns} assignees={assignees} pending={mutation.isPending} onOpen={open} onCreate={create} onMove={move} />
            {editor && <CardDialog board={board} editor={editor} pending={mutation.isPending} onClose={close}
              onSave={(action) => mutation.mutateAsync(action)} />}
          </>
        ) : query.isError ? (
          <div className={styles.placeholder} role="alert">
            <p>Couldn’t load the sprint board.</p>
            <button type="button" className={styles.primary} onClick={retry}>Try again</button>
          </div>
        ) : <p className={styles.placeholder} role="status">Loading sprint board…</p>}
      </main>
      {notice && (
        <div className={styles.toast}>
          <span role="status">{notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={16} /></button>
        </div>
      )}
    </>
  );
}
