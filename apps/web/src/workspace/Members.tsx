import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { memberRoleSchema, type BoardSummary, type MemberRole } from '@board/shared';
import { BoardDialog } from '../components/BoardDialog/BoardDialog';
import { editMember, errorMessage, getMembers, inviteMember, removeMember, revokeInvite } from './api';
import styles from './Workspace.module.css';

type Action = { kind: 'invite'; email: string; role: MemberRole }
  | { kind: 'role'; account: string; role: MemberRole }
  | { kind: 'remove'; account: string }
  | { kind: 'revoke'; email: string };

export const roleNames = { OWNER: 'Owner', EDITOR: 'Editor', VIEWER: 'Viewer' } as const;

export function Members({ board, onClose }: { board: BoardSummary; onClose: () => void }) {
  const client = useQueryClient();
  const queryKey = ['board-members', board.id] as const;
  const members = useQuery({ queryKey, queryFn: ({ signal }) => getMembers(board.id, signal) });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('EDITOR');
  const update = useMutation({
    mutationFn: (action: Action) => {
      switch (action.kind) {
        case 'invite': return inviteMember(board.id, action.email, action.role);
        case 'role': return editMember(board.id, action.account, action.role);
        case 'remove': return removeMember(board.id, action.account);
        case 'revoke': return revokeInvite(board.id, action.email);
      }
    },
    onSuccess: async (_, action) => {
      if (action.kind === 'invite') setEmail('');
      await client.invalidateQueries({ queryKey });
    },
  });

  return (
    <BoardDialog title="Board members" onClose={onClose}>
      {members.isPending && <p role="status">Loading members…</p>}
      {members.error && <p role="alert">{errorMessage(members.error)}</p>}
      {members.data && (
        <>
          <ul className={styles.people}>
            {members.data.people.map((person) => (
              <li key={person.id}>
                <span>{person.name || 'Board member'}</span>
                {person.role === 'OWNER' ? <span>Owner</span> : (
                  <div className={styles.actions}>
                    <select aria-label={'Role for ' + (person.name || 'board member')} value={person.role}
                      disabled={update.isPending} onChange={(event) => {
                        update.mutate({ kind: 'role', account: person.id, role: memberRoleSchema.parse(event.target.value) });
                      }}>
                      <option value="EDITOR">Editor</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                    <button type="button" disabled={update.isPending} onClick={() => update.mutate({ kind: 'remove', account: person.id })}>
                      Remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {members.data.invitations.length > 0 && (
            <>
              <h3>Pending invitations</h3>
              <ul className={styles.people}>
                {members.data.invitations.map((invitation) => (
                  <li key={invitation.email}>
                    <span>{invitation.email} · {roleNames[invitation.role]}</span>
                    <button type="button" disabled={update.isPending}
                      onClick={() => update.mutate({ kind: 'revoke', email: invitation.email })}>Cancel invitation</button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <form className={styles.form} onSubmit={(event) => {
            event.preventDefault();
            update.mutate({ kind: 'invite', email, role });
          }}>
            <h3>Invite by email</h3>
            <p>The invitation appears in the recipient’s workspace after they sign in.</p>
            <label>Email<input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Role<select aria-label="Invitation role" value={role} onChange={(event) => setRole(memberRoleSchema.parse(event.target.value))}>
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
            </select></label>
            {update.error && <p className={styles.error} role="alert">{errorMessage(update.error)}</p>}
            <button className={styles.primary} type="submit" disabled={update.isPending}>Invite</button>
          </form>
        </>
      )}
    </BoardDialog>
  );
}
