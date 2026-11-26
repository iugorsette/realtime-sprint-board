import { z } from 'zod';

export * from './ordering';

export const DEMO_BOARD_ID = 'sprint-board';
export const idSchema = z.string().trim().min(1).max(100);
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
  assigneeId: idSchema.nullable(),
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
export const boardSchema = z.object({
  id: idSchema,
  name: z.string(),
  revision: z.number().int().nonnegative(),
  columns: z.array(columnSchema),
  assignees: z.array(assigneeSchema),
});
export const createCardSchema = cardFields.extend({ columnId: idSchema }).strict();
export const updateCardSchema = cardFields.extend({ expectedVersion: versionSchema }).strict();
export const moveCardSchema = z.strictObject({
  targetColumnId: idSchema,
  beforeCardId: idSchema.nullable(),
  expectedVersion: versionSchema,
});

export type Card = z.infer<typeof cardSchema>;
export type Column = z.infer<typeof columnSchema>;
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
export type ServerToClientEvents = Record<CardEvent, (change: BoardChange) => void>;
export interface ClientToServerEvents {
  'board:join': (boardId: string, acknowledge: (result: { ok: boolean }) => void) => void;
}
