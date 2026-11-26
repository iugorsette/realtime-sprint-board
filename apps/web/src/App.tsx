import { useCallback, useMemo, useState } from 'react';
import { Columns3, Radio, X } from 'lucide-react';
import { DEMO_BOARD_ID, type Card, type MoveCard } from '@board/shared';
import { useBoard } from './board/useBoard';
import { filterColumns } from './board/model';
import { Avatar } from './components/CardTile/CardTile';
import { BoardGrid } from './components/BoardGrid/BoardGrid';
import { CardDialog } from './components/CardDialog/CardDialog';
import { CardComposer } from './components/CardComposer/CardComposer';
import { emptyFilters, FiltersBar } from './components/FiltersBar/FiltersBar';
import styles from './App.module.css';

const connectionLabels = { connecting: 'Connecting', live: 'Live sync', offline: 'Sync offline' };

export function App() {
  const { query, mutation, connection, retry } = useBoard(DEMO_BOARD_ID);
  const { data: board } = query;
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedCardId, setSelectedCardId] = useState<string>();
  const [draftColumn, setDraftColumn] = useState<string>();
  const [notice, setNotice] = useState('');
  const openCard = useCallback((card: Card) => setSelectedCardId(card.id), []);
  const closeCard = useCallback(() => setSelectedCardId(undefined), []);
  const selectedCard = selectedCardId
    ? board?.columns.flatMap(({ cards }) => cards).find(({ id }) => id === selectedCardId)
    : undefined;
  const closeDraft = useCallback(() => setDraftColumn(undefined), []);
  const columns = useMemo(() => board ? filterColumns(board.columns, filters) : [], [board, filters]);
  const columnTotals = useMemo(() => new Map(board?.columns.map((column) => [column.id, column.cards.length])), [board?.columns]);
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

  const total = board?.columns.reduce((sum, column) => sum + column.cards.length, 0) ?? 0;
  const done = board?.columns.find(({ id }) => id === 'done')?.cards.length ?? 0;
  const shown = columns.reduce((sum, column) => sum + column.cards.length, 0);

  return (
    <>
      <header className={styles.top}>
        <div className={styles.topInner}>
          <h1 className={styles.brand}><span className={styles.logo}><Columns3 size={18} aria-hidden="true" /></span>{board?.name ?? 'Sprint Board'}</h1>
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
        {board ? (
          <>
            <div className={styles.toolbar}>
              <FiltersBar filters={filters} onChange={setFilters} assignees={board.assignees} tags={tags}
                columns={columns} filtersInDialog={false} onOpenCard={openCard} />
              <div className={styles.metrics}>
                <span>{shown !== total ? `${shown} of ${total} cards` : `${total} ${total === 1 ? 'card' : 'cards'}`}</span>
                <span className={styles.progress}><progress max={total || 1} value={done} aria-label="Completed cards" />{done} done</span>
              </div>
            </div>
            <BoardGrid
              columns={columns} columnTotals={columnTotals} assignees={assignees} pending={mutation.isPending}
              onOpen={openCard} onCreate={setDraftColumn} onMove={move}
              draft={draftColumn ? {
                columnId: draftColumn,
                content: <CardComposer columnId={draftColumn}
                  pending={mutation.isPending} onClose={closeDraft}
                  onSave={async (input) => { await mutation.mutateAsync({ type: 'create', input }); }} />,
              } : undefined}
            />
            {selectedCard && <CardDialog key={selectedCard.id} board={board} card={selectedCard} availableTags={tags} pending={mutation.isPending} onClose={closeCard}
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
