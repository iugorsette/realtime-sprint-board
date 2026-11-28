import { accountSchema, boardSummarySchema, cardLocationSchema, membersSchema, requestErrorSchema, workspaceSchema,
  type CreateColumn, type MemberRole, type UpdateColumn } from '@board/shared';

class WorkspaceError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function request(path: string, method = 'GET', body?: object, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(12_000);
  const response = await fetch('/api' + path, {
    method, cache: 'no-store', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body && JSON.stringify(body),
  });
  if (response.status === 204) return;
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const details = requestErrorSchema.safeParse(payload);
    throw new WorkspaceError(response.status, details.success ? details.data.message : 'Something went wrong. Try again.');
  }
  return payload;
}

export async function session(signal?: AbortSignal) {
  try {
    return accountSchema.parse(await request('/me', 'GET', undefined, signal));
  } catch (error) {
    if (error instanceof WorkspaceError && error.status === 401) return null;
    throw error;
  }
}

export const sendCode = (email: string) => request('/auth/code', 'POST', { email });
export const verifyCode = async (email: string, code: string) => accountSchema.parse(await request('/auth/verify', 'POST', { email, code }));
export const signOut = () => request('/auth/logout', 'POST').catch((error: unknown) => {
  if (!(error instanceof WorkspaceError) || error.status !== 401) throw error;
});
export const saveProfile = async (name: string, avatar?: string | null) =>
  accountSchema.parse(await request('/me', 'PATCH', { name, avatar }));
export const getWorkspace = async (signal?: AbortSignal) => workspaceSchema.parse(await request('/workspace', 'GET', undefined, signal));
export const createBoard = async (name: string) => boardSummarySchema.parse(await request('/boards', 'POST', { name }));
export const locateCard = async (id: string, signal?: AbortSignal) =>
  cardLocationSchema.parse(await request('/card-links/' + encodeURIComponent(id), 'GET', undefined, signal));
const boardPath = (id: string) => '/boards/' + encodeURIComponent(id);
const columnsPath = (boardId: string) => boardPath(boardId) + '/columns';
const columnPath = (boardId: string, id: string) => columnsPath(boardId) + '/' + encodeURIComponent(id);
export const createColumn = (boardId: string, input: CreateColumn) => request(columnsPath(boardId), 'POST', input);
export const updateColumn = (boardId: string, id: string, input: UpdateColumn) => request(columnPath(boardId, id), 'PATCH', input);
export const deleteColumn = (boardId: string, id: string, expectedName: string) =>
  request(columnPath(boardId, id), 'DELETE', { expectedName });
const memberPath = (boardId: string, accountId: string) => boardPath(boardId) + '/members/' + encodeURIComponent(accountId);
export const getMembers = async (id: string, signal?: AbortSignal) =>
  membersSchema.parse(await request(boardPath(id) + '/members', 'GET', undefined, signal));
export const inviteMember = (id: string, email: string, role: MemberRole) => request(boardPath(id) + '/invites', 'POST', { email, role });
export const acceptInvite = (id: string) => request(boardPath(id) + '/accept-invite', 'POST');
export const revokeInvite = (id: string, email: string) => request(boardPath(id) + '/revoke-invite', 'POST', { email });
export const editMember = (boardId: string, accountId: string, role: MemberRole) => request(memberPath(boardId, accountId), 'PATCH', { role });
export const removeMember = (boardId: string, accountId: string) => request(memberPath(boardId, accountId), 'DELETE');
export const errorMessage = (error: unknown) => error instanceof WorkspaceError ? error.message : 'Could not complete the request. Try again.';
