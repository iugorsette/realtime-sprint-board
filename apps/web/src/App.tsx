import { useCallback, useEffect, useMemo, useState } from 'react';
import { Columns3, List, Radio, Settings, X } from 'lucide-react';
import { DEMO_BOARD_ID, type Card, type MoveCard } from '@board/shared';
import { useOfflineBoard } from './board/useOfflineBoard';
import { cardId, findCard } from './board/offline';
import { useCardLocation } from './board/useCardLocation';
import { usePreferences } from './board/preferences';
import { PreferencesDialog } from './components/Preferences/PreferencesDialog';
import { filterColumns } from './board/model';
import { Avatar } from './components/CardTile/CardTile';
import { BoardGrid } from './components/BoardGrid/BoardGrid';
import { CardList } from './components/CardList/CardList';
import { CardDialog } from './components/CardDialog/CardDialog';
import { CardComposer } from './components/CardComposer/CardComposer';
import { emptyFilters, FiltersBar } from './components/FiltersBar/FiltersBar';
import { SyncDialog } from './components/SyncDialog/SyncDialog';
import styles from './App.module.css';

const connectionLabels = { connecting: 'Connecting', live: 'Live sync', offline: 'Connection lost' };
const boardViews = [
  { value: 'board', label: 'Board', Icon: Columns3 },
  { value: 'list', label: 'List', Icon: List },
] as const;

export function App() {
  const sync = useOfflineBoard(DEMO_BOARD_ID);
  const { board, query, mutation, connection, offline, syncing, pendingCount } = sync;
  const { preferences, setPreferences } = usePreferences();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [syncView, setSyncView] = useState<'sync' | 'review'>();
  const [reviewId, setReviewId] = useState<string>();
  const [filters, setFilters] = useState(emptyFilters);
  const [draftColumn, setDraftColumn] = useState<string>();
  const [notice, setNotice] = useState('');
  const closeOtherDialogs = useCallback(() => {
    setPreferencesOpen(false);
    setSyncView(undefined);
  }, []);
  const { selectedLinkId, openCardLink, dismissCard } = useCardLocation(closeOtherDialogs);
  const openCard = useCallback((card: Card) => {
    setNotice('');
    openCardLink({ id: card.id, title: offline ? undefined : card.title });
  }, [offline, openCardLink]);
  const selectedCard = selectedLinkId && board ? findCard(board, selectedLinkId) : undefined;
  const savedCard = selectedCard && sync.server ? findCard(sync.server, selectedCard.id) : undefined;
  const missingCard = selectedLinkId !== undefined && !selectedCard;
  useEffect(() => {
    if (!missingCard || selectedLinkId === undefined || offline || syncing || mutation.isPending ||
      !query.isFetchedAfterMount || !query.isSuccess) return;
    dismissCard(selectedLinkId, true);
    setNotice('This card is no longer available.');
  }, [dismissCard, missingCard, selectedLinkId, offline, syncing, mutation.isPending, query.isFetchedAfterMount, query.isSuccess]);
  const reviewIds = [...new Set(sync.conflicts.map(cardId))];
  const activeReviewId = reviewId && reviewIds.includes(reviewId) ? reviewId : reviewIds[0];
  const reviewChanges = syncView === 'review' ? sync.conflicts.filter((change) => cardId(change) === activeReviewId) : [];
  const reviewCard = board && activeReviewId && reviewChanges.length > 0 ? findCard(board, activeReviewId) : undefined;
  const displayedCard = reviewChanges[0] ? reviewCard ?? reviewChanges[0].original : selectedCard;
  const reviewing = reviewChanges.length > 0;
  const syncOpen = syncView === 'sync';
  useEffect(() => {
    if (syncView === 'review' && !reviewing && !syncing) setSyncView(undefined);
  }, [syncView, reviewing, syncing]);
  const closeDraft = useCallback(() => setDraftColumn(undefined), []);
  const columns = useMemo(() => board ? filterColumns(board.columns, filters) : [], [board, filters]);
  const columnTotals = useMemo(() => new Map(board?.columns.map((column) => [column.id, column.cards.length])), [board?.columns]);
  const assignees = useMemo(() => new Map(board?.assignees.map((person) => [person.id, person])), [board?.assignees]);
  const tags = useMemo(() => [...new Set(board?.columns.flatMap((column) => column.cards.flatMap((card) => card.tags)))].sort(), [board?.columns]);

  async function move(card: Card, input: MoveCard) {
    if (offline || syncing) return;
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
  const syncLabel = syncing || (!offline && query.isFetching) ? 'Syncing…'
    : offline ? 'Working offline' : connectionLabels[query.isError ? 'offline' : connection];
  const pendingLabel = sync.conflicts.length ? `${sync.conflicts.length} to review` : `${pendingCount} pending`;
  const syncStatus = pendingCount > 0 ? `${syncLabel} · ${pendingLabel}` : syncLabel;
  const pending = mutation.isPending || syncing;
  const draft = draftColumn ? {
    columnId: draftColumn,
    content: <CardComposer columnId={draftColumn} pending={pending} offline={offline} onClose={closeDraft}
      onSave={sync.create} onDiscard={sync.discardCreation} onWorkOffline={sync.workOffline} />,
  } : undefined;
  const viewProps = { columns, columnTotals, assignees, pending, pendingCards: sync.pendingCards, onOpen: openCard, onCreate: setDraftColumn, draft };

  function openReview(id?: string) {
    setReviewId(id);
    if (selectedLinkId !== undefined) dismissCard(selectedLinkId);
    setSyncView('review');
  }

  function closeDetails() {
    if (reviewing) setSyncView(undefined);
    else if (selectedLinkId !== undefined) dismissCard(selectedLinkId);
  }

  return (
    <>
      <header className={styles.top}>
        <div className={styles.topInner}>
          <h1 className={styles.brand}><span className={styles.logo}><Columns3 size={18} aria-hidden="true" /></span><span className={styles.brandName}>{board?.name ?? 'Sprint Board'}</span></h1>
          <div className={styles.topRight}>
            <button type="button" className={styles.connection} data-connection={offline ? 'offline' : connection}
              aria-label={syncStatus} aria-haspopup="dialog" aria-expanded={syncOpen || reviewing}
              onClick={() => {
                if (reviewIds.length) openReview();
                else setSyncView('sync');
              }}>
              <Radio size={15} aria-hidden="true" />
              <span role="status">{syncStatus}</span>
            </button>
            {board && (
              <div className={styles.people} aria-label="Board assignees">
                {board.assignees.map((person) => <Avatar key={person.id} person={person} />)}
              </div>
            )}
            <button type="button" className={styles.preferences} aria-label="Preferences"
              onClick={() => setPreferencesOpen(true)}><Settings size={18} aria-hidden="true" /></button>
          </div>
        </div>
      </header>
      {preferencesOpen && <PreferencesDialog value={preferences} onChange={setPreferences} onClose={() => setPreferencesOpen(false)} />}
      {syncOpen && <SyncDialog board={sync.server} offline={offline} syncing={syncing || mutation.isPending} pendingCount={pendingCount}
        notice={sync.notice} conflictCount={sync.conflicts.length} onClose={() => setSyncView(undefined)}
        onWorkOffline={sync.workOffline} onReview={() => openReview()} onResume={async () => {
          if (await sync.resume()) {
            setReviewId(undefined);
            setSyncView((view) => view === 'sync' ? 'review' : view);
          }
        }} />}
      <main className={styles.main}>
        {board ? (
          <>
            {missingCard && (offline || connection === 'offline' || query.isError) && (
              <p className={styles.placeholder} role="status">
                This card isn’t in the saved board. {offline ? 'Resume sync' : 'Reconnect'} to look for it again.
              </p>
            )}
            <div className={styles.toolbar}>
              <FiltersBar filters={filters} onChange={setFilters} assignees={board.assignees} tags={tags}
                columns={columns} filtersInDialog={preferences.filtersInDialog} onOpenCard={openCard} />
              <div className={styles.toolbarSummary}>
                <div className={styles.metrics}>
                  <span>{shown !== total ? `${shown} of ${total} cards` : `${total} ${total === 1 ? 'card' : 'cards'}`}</span>
                  <span className={styles.progress}><progress max={total || 1} value={done} aria-label="Completed cards" />{done} done</span>
                </div>
                <fieldset className={styles.viewPicker} aria-label="Board view" disabled={Boolean(draft)}
                  title={draft ? 'Finish or cancel the new card to switch views' : undefined}>
                  {boardViews.map(({ value, label, Icon }) => (
                    <label key={value}>
                      <input type="radio" name="board-view" checked={preferences.view === value}
                        onChange={() => setPreferences((current) => ({ ...current, view: value }))} />
                      <span><Icon size={15} aria-hidden="true" />{label}</span>
                    </label>
                  ))}
                </fieldset>
              </div>
            </div>
            {preferences.view === 'list' ? <CardList {...viewProps} />
              : <BoardGrid {...viewProps} dragDisabled={offline || syncing} onMove={move} />}
            {displayedCard && <CardDialog key={displayedCard.id} board={board} card={displayedCard} availableTags={tags}
              pending={mutation.isPending} onClose={closeDetails} offline={offline} syncing={syncing}
              savedTitle={savedCard?.title}
              onReview={!reviewing && reviewIds.includes(displayedCard.id) ? () => openReview(displayedCard.id) : undefined}
              review={reviewing ? {
                changes: reviewChanges, deleted: !reviewCard, notice: sync.notice, onResolve: sync.resolve,
                onRecoverDeleted: sync.recoverDeleted,
                onNext: reviewIds.length > 1 ? () => setReviewId(reviewIds[(reviewIds.indexOf(displayedCard.id) + 1) % reviewIds.length]) : undefined,
                onSyncSettings: () => setSyncView('sync'),
              } : undefined}
              onSave={(action) => mutation.mutateAsync(action)}
              onSaveText={sync.saveText} onDiscardText={sync.discardText} onWorkOffline={sync.workOffline} />}
          </>
        ) : query.isError ? (
          <div className={styles.placeholder} role="alert">
            <p>Couldn’t load the sprint board.</p>
            <button type="button" className={styles.primary} onClick={sync.retry}>Try again</button>
          </div>
        ) : <p className={styles.placeholder} role="status">Loading sprint board…</p>}
      </main>
      {(notice || (sync.notice && !syncOpen && !reviewing)) && (
        <div className={styles.toast}>
          <span role="status">{notice || sync.notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => { setNotice(''); sync.setNotice(''); }}><X size={16} /></button>
        </div>
      )}
    </>
  );
}
