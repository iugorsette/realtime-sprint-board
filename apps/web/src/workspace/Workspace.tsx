import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Columns3, Menu, Plus, UserRound } from 'lucide-react';
import type { Account, BoardSummary } from '@board/shared';
import { App } from '../App';
import { BoardDialog } from '../components/BoardDialog/BoardDialog';
import { acceptInvite, createBoard, errorMessage, getWorkspace, locateCard, removeMember, session, signOut } from './api';
import { Members, roleNames } from './Members';
import { Profile } from './Profile';
import { SignIn } from './SignIn';
import styles from './Workspace.module.css';

const sessionKey = ['session'] as const;
const workspaceKey = ['workspace'] as const;
const sessionEvent = 'sprint-board:session-change';

function notifyTabs() {
  try { localStorage.setItem(sessionEvent, crypto.randomUUID()); } catch { /* Polling still revalidates sessions. */ }
}

function readRoute() {
  const params = new URL(location.href).searchParams;
  return { board: params.get('boardId'), card: params.get('cardId') };
}

function WorkspaceBoard({ access, headerActions }: { access: BoardSummary; headerActions: HTMLElement | null }) {
  const [client] = useState(() => new QueryClient());
  useEffect(() => () => client.clear(), [client]);
  return <QueryClientProvider client={client}><App access={access} headerActions={headerActions} /></QueryClientProvider>;
}

function SignedInWorkspace({ account, onSave, onLogout }: {
  account: Account;
  onSave: (account: Account) => void;
  onLogout: () => void;
}) {
  const client = useQueryClient();
  const data = useQuery({ queryKey: workspaceKey, queryFn: ({ signal }) => getWorkspace(signal), refetchInterval: 15_000 });
  const [route, setRoute] = useState(readRoute);
  const [headerActions, setHeaderActions] = useState<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState<'boards' | 'profile' | 'create' | 'invitations' | 'members' | 'leave' | undefined>(
    account.name || route.card ? undefined : 'profile',
  );
  const [name, setName] = useState('');
  const cardLink = useQuery({ queryKey: ['card-link', route.card], enabled: Boolean(route.card && !route.board),
    queryFn: ({ signal }) => locateCard(route.card ?? '', signal), retry: false });
  const requested = route.board ?? cardLink.data?.boardId;
  const board = requested || route.card ? data.data?.boards.find(({ id }) => id === requested) : data.data?.boards[0];
  const unavailable = !data.isPending && (Boolean(requested && !board) || cardLink.isError);
  const boardMenuOpen = panel === 'boards' || panel === 'create';
  const invitationCount = data.data?.invitations.length ?? 0;
  const afterChange = () => client.invalidateQueries({ queryKey: workspaceKey });

  function chooseBoard(id: string) {
    const url = new URL(location.href);
    if (id) url.searchParams.set('boardId', id);
    else url.searchParams.delete('boardId');
    url.searchParams.delete('cardId');
    url.searchParams.delete('slug');
    window.history.pushState({ openedFromBoard: false }, '', url);
    setRoute(readRoute());
  }

  useEffect(() => {
    function onPopState() {
      setPanel(undefined);
      setRoute(readRoute());
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!board) return;
    const url = new URL(location.href);
    if (route.board && !url.searchParams.has('slug')) return;
    url.searchParams.set('boardId', board.id);
    url.searchParams.delete('slug');
    window.history.replaceState(window.history.state, '', url);
    setRoute(readRoute());
  }, [board, route.board]);

  const create = useMutation({ mutationFn: () => createBoard(name), onSuccess: async (created) => {
    await afterChange();
    chooseBoard(created.id);
    setPanel(undefined);
  } });
  const accept = useMutation({ mutationFn: acceptInvite, onSuccess: async (_, id) => {
    await afterChange();
    chooseBoard(id);
    setPanel(undefined);
  } });
  const leave = useMutation({ mutationFn: (id: string) => removeMember(id, account.id), onSuccess: async () => {
    chooseBoard('');
    setPanel(undefined);
    await afterChange();
  } });
  const logout = useMutation({ mutationFn: signOut, onSuccess: onLogout });

  return (
    <>
      <header className={styles.masthead}>
        <div className={styles.mastheadInner}>
          <button type="button" className={styles.boardsButton} aria-label="Open boards" aria-haspopup="dialog"
            aria-expanded={boardMenuOpen} data-invitations={invitationCount > 0 || undefined} onClick={() => setPanel('boards')}>
            <Menu size={21} aria-hidden="true" />
          </button>
          <h1>{board?.name ?? 'Sprint Board'}</h1>
          <div ref={setHeaderActions} className={styles.boardActions} />
          <button type="button" className={styles.profileButton} aria-label="Profile" aria-haspopup="dialog"
            aria-expanded={panel === 'profile'} onClick={() => setPanel('profile')}>
            {account.avatar ? <img className={styles.avatar} width="32" height="32" alt="" src={'data:image/png;base64,' + account.avatar} />
              : <UserRound size={18} aria-hidden="true" />}
          </button>
        </div>
      </header>
      {unavailable ? <p className={styles.pageStatus} role="alert">This board or card is unavailable to this account.</p>
        : data.isError ? <p className={styles.pageStatus} role="alert">Connect to the server to view your boards.</p>
        : board ? <WorkspaceBoard key={board.id} access={board} headerActions={headerActions} />
        : data.isPending || (route.card && cardLink.isPending) ? <p className={styles.pageStatus} role="status">Loading workspace…</p>
        : <p className={styles.pageStatus}>Create a board or accept an invitation to get started.</p>}
      {panel === 'profile' && (
        <Profile account={account} onSave={(profile) => { onSave(profile); setPanel(undefined); }} onClose={() => setPanel(undefined)}
          onLogout={() => logout.mutate()} logoutPending={logout.isPending} logoutError={logout.error ? errorMessage(logout.error) : undefined} />
      )}
      {boardMenuOpen && (
        <BoardDialog title="Boards" placement="left" onClose={() => setPanel(undefined)}>
          <div className={styles.drawer}>
            <button type="button" className={styles.drawerButton} aria-expanded={panel === 'create'} onClick={() => {
              if (panel === 'create') setPanel('boards');
              else { setName(''); create.reset(); setPanel('create'); }
            }}><Plus size={17} aria-hidden="true" /> New board</button>
            {panel === 'create' && (
              <form className={styles.form} onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
                <label>Board name<input value={name} required maxLength={80} autoFocus onChange={(event) => setName(event.target.value)} /></label>
                {create.error && <p role="alert" className={styles.error}>{errorMessage(create.error)}</p>}
                <button type="submit" className={styles.primary} disabled={create.isPending}>Create board</button>
              </form>
            )}
            <nav aria-label="Your boards">
              <ul className={styles.boardList}>
                {data.data?.boards.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={styles.drawerButton} aria-current={item.id === board?.id ? 'page' : undefined}
                      onClick={() => {
                        if (item.id !== board?.id) chooseBoard(item.id);
                        setPanel(undefined);
                      }}>
                      <Columns3 size={17} aria-hidden="true" />
                      <span className={styles.boardName}>{item.name}</span><small>{roleNames[item.role]}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <div className={styles.drawerActions}>
              {board?.role === 'OWNER' && <button type="button" className={styles.drawerButton} onClick={() => setPanel('members')}>Members</button>}
              {board && board.role !== 'OWNER' && <button type="button" className={styles.drawerButton} onClick={() => setPanel('leave')}>Leave board</button>}
              {invitationCount > 0 && <button type="button" className={styles.drawerButton} onClick={() => setPanel('invitations')}>
                Invitations ({invitationCount})
              </button>}
            </div>
          </div>
        </BoardDialog>
      )}
      {panel === 'invitations' && (
        <BoardDialog title="Invitations" onClose={() => setPanel('boards')}>
          <ul className={styles.people}>
            {data.data?.invitations.map((invite) => (
              <li key={invite.id}>
                <span>{invite.name} · {roleNames[invite.role]}</span>
                <button type="button" disabled={accept.isPending} onClick={() => accept.mutate(invite.id)}>Accept</button>
              </li>
            ))}
          </ul>
          {accept.error && <p role="alert" className={styles.error}>{errorMessage(accept.error)}</p>}
        </BoardDialog>
      )}
      {panel === 'members' && board?.role === 'OWNER' && <Members key={board.id} board={board} onClose={() => setPanel('boards')} />}
      {panel === 'leave' && board && (
        <BoardDialog title="Leave board" onClose={() => setPanel('boards')}>
          <p>You will need a new invitation to rejoin {board.name}.</p>
          {leave.error && <p role="alert" className={styles.error}>{errorMessage(leave.error)}</p>}
          <button type="button" disabled={leave.isPending} onClick={() => leave.mutate(board.id)}>Leave board</button>
        </BoardDialog>
      )}
    </>
  );
}

function AccountWorkspace({ account, onSave, onLogout }: {
  account: Account; onSave: (account: Account) => void; onLogout: () => void;
}) {
  const [client] = useState(() => new QueryClient());
  useEffect(() => () => client.clear(), [client]);
  return <QueryClientProvider client={client}><SignedInWorkspace account={account} onSave={onSave} onLogout={onLogout} /></QueryClientProvider>;
}

export function Workspace() {
  const client = useQueryClient();
  const account = useQuery({ queryKey: sessionKey, queryFn: ({ signal }) => session(signal), refetchInterval: 15_000, retry: false });
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === sessionEvent) {
        client.setQueryData(sessionKey, null);
        void client.invalidateQueries({ queryKey: sessionKey });
      }
    }
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sprint-board:offline:v1:')) localStorage.removeItem(key);
      }
    } catch { /* Private boards always ignore the legacy offline store. */ }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [client]);

  async function setAccount(next: Account | null) {
    await client.cancelQueries({ queryKey: sessionKey });
    client.setQueryData(sessionKey, next);
  }

  if (account.isPending) return <p className={styles.pageStatus} role="status">Checking session…</p>;
  if (account.isError) return <main className={styles.entry}>
    <h1>Sprint Board</h1><p role="alert">Connect to the server to sign in and view private boards.</p>
    <button type="button" onClick={() => void account.refetch()}>Try again</button>
  </main>;
  if (!account.data) return <SignIn onSignIn={(person) => { void setAccount(person); notifyTabs(); }} />;
  return (
    <AccountWorkspace key={account.data.id} account={account.data} onSave={(person) => void setAccount(person)}
      onLogout={() => { void setAccount(null); notifyTabs(); }} />
  );
}
