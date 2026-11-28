import { z } from 'zod';

export * from './ordering';
export { mvpCardId } from './mvpCardId';

export const DEMO_BOARD_ID = 'sprint-board';
export const idSchema = z.string().trim().min(1).max(100);
export const emailSchema = z.string().trim().max(254).pipe(z.email()).transform((value) => value.toLowerCase());
export const roleSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER']);
export const memberRoleSchema = roleSchema.exclude(['OWNER']);
export const boardNameSchema = z.string().trim().min(1).max(80);
export const profileSchema = z.strictObject({
  name: z.string().trim().min(1).max(60),
  avatar: z.string().max(90_000).regex(/^[A-Za-z0-9+/]+={0,2}$/).nullable().optional(),
});
export const boardSummarySchema = z.object({ id: idSchema, name: boardNameSchema, role: roleSchema });
export const accountSchema = z.object({ id: idSchema, email: emailSchema, name: z.string(), avatar: z.string().nullable() });
export const cardLocationSchema = z.object({ boardId: idSchema });
export const requestErrorSchema = z.object({ message: z.string() });
export const workspaceSchema = z.object({
  boards: z.array(boardSummarySchema),
  invitations: z.array(boardSummarySchema.extend({ role: memberRoleSchema })),
});
export const membersSchema = z.object({
  people: z.array(z.object({ id: idSchema, name: z.string(), role: roleSchema })),
  invitations: z.array(z.object({ email: emailSchema, role: memberRoleSchema })),
});
export type Account = z.infer<typeof accountSchema>;
export type BoardSummary = z.infer<typeof boardSummarySchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
export const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const assigneeSchema = z.object({
  id: idSchema,
  name: z.string(),
  initials: z.string(),
});

const cardFields = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  priority: prioritySchema,
  assigneeIds: z.array(idSchema).transform((ids) => [...new Set(ids)]),
  tags: z.array(z.string().trim().min(1).max(30).toLowerCase()).max(10)
    .transform((tags) => [...new Set(tags)]),
});

export const versionSchema = z.number().int().positive();
export const cardSchema = cardFields.extend({
  id: idSchema,
  columnId: idSchema,
  position: z.number(),
  version: versionSchema,
});
export const columnSchema = z.object({
  id: idSchema,
  name: z.string(),
  position: z.number(),
  cards: z.array(cardSchema),
});
export const columnNameSchema = z.string().trim().min(1).max(80);
export const createColumnSchema = z.strictObject({ name: columnNameSchema });
export const deleteColumnSchema = z.strictObject({ expectedName: z.string().max(80) });
export const renameColumnSchema = createColumnSchema.extend(deleteColumnSchema.shape);
export const boardSchema = z.object({
  id: idSchema,
  name: z.string(),
  revision: z.number().int().nonnegative(),
  columns: z.array(columnSchema),
  assignees: z.array(assigneeSchema),
});
export const createCardSchema = cardFields.extend({
  id: z.uuid().transform((id) => id.toLowerCase()).optional(),
  columnId: idSchema,
}).strict();
export const updateCardSchema = cardFields.extend({ expectedVersion: versionSchema }).strict();
export const moveCardSchema = z.strictObject({
  targetColumnId: idSchema,
  beforeCardId: idSchema.nullable(),
  expectedVersion: versionSchema,
});

export type Card = z.infer<typeof cardSchema>;
export type Column = z.infer<typeof columnSchema>;
export type CreateColumn = z.infer<typeof createColumnSchema>;
export type RenameColumn = z.infer<typeof renameColumnSchema>;
export type Board = z.infer<typeof boardSchema>;
export type Assignee = z.infer<typeof assigneeSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type CreateCard = z.infer<typeof createCardSchema>;
export type UpdateCard = z.infer<typeof updateCardSchema>;
export type MoveCard = z.infer<typeof moveCardSchema>;

export interface BoardChange {
  boardId: string;
  revision: number;
  cards: Card[];
  deletedCardIds: string[];
}

export interface CardConflict {
  code: 'CARD_VERSION_CONFLICT' | 'BOARD_ORDER_CHANGED';
  card: Card | null;
}
export const cardEvents = ['card:created', 'card:updated', 'card:moved', 'card:deleted'] as const;
export type CardEvent = typeof cardEvents[number];
export type ServerToClientEvents = Record<CardEvent, (change: BoardChange) => void> & {
  'board:refresh': () => void;
};
export interface ClientToServerEvents {
  'board:join': (boardId: string, acknowledge: (result: { ok: boolean }) => void) => void;
}
