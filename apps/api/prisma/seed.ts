import { DEMO_BOARD_ID, POSITION_STRIDE, type Priority } from '@board/shared';
import { createDatabase } from '../src/database';

const people = [
  { id: 'maya', name: 'Maya Chen', initials: 'MC' },
  { id: 'jules', name: 'Jules Rivera', initials: 'JR' },
  { id: 'sam', name: 'Sam Okafor', initials: 'SO' },
  { id: 'alex', name: 'Alex Morgan', initials: 'AM' },
];

const columns: { id: string; name: string; cards: [string, string, Priority, string[], string[]][] }[] = [
  { id: 'backlog', name: 'Backlog', cards: [
    ['Add a board activity feed', 'Design a compact timeline for card updates and moves.', 'MEDIUM', ['frontend'], ['maya']],
    ['Explore offline editing', 'Define expected behavior when a connection drops during a mutation.', 'LOW', ['research'], []],
    ['Profile long columns', 'Measure rendering cost when a column contains hundreds of cards.', 'MEDIUM', ['performance'], ['sam']],
  ] },
  { id: 'todo', name: 'Todo', cards: [
    ['Improve empty states', 'Make filtered and truly empty columns easy to distinguish.', 'MEDIUM', ['design'], ['jules']],
    ['Validate reconnect behavior', 'Check that a refreshed snapshot includes changes made in another tab.', 'HIGH', ['realtime', 'testing'], ['sam']],
    ['Document the API contracts', 'Add examples of mutation responses and version conflicts.', 'LOW', ['docs'], ['alex']],
  ] },
  { id: 'in-progress', name: 'In Progress', cards: [
    ['Harden concurrent card moves', 'Verify the first committed write wins and stale writes reconcile cleanly.', 'URGENT', ['backend', 'realtime'], ['sam', 'alex']],
    ['Polish keyboard drag and drop', 'Check focus restoration and screen reader announcements across columns.', 'HIGH', ['accessibility'], ['maya']],
    ['Review filter interactions', 'Measure how the board responds to combining tag, assignee and priority filters.', 'MEDIUM', ['frontend'], ['jules']],
  ] },
  { id: 'done', name: 'Done', cards: [
    ['Bootstrap the workspace', 'Create the shared contracts and package scripts.', 'MEDIUM', ['platform'], ['alex']],
    ['Set up local PostgreSQL', 'Configure Compose health checks and a named volume.', 'HIGH', ['backend'], ['sam']],
    ['Define board design tokens', 'Set up typography, color, spacing and focus styles.', 'LOW', ['design'], ['jules']],
  ] },
];

const db = createDatabase();
async function seed() {
  await db.$transaction(async (tx) => {
    const result = await tx.board.createMany({
      data: { id: DEMO_BOARD_ID, name: 'Sprint Board' },
      skipDuplicates: true,
    });
    if (result.count === 0) return;

    await tx.assignee.createMany({ data: people.map((person) => ({ ...person, boardId: DEMO_BOARD_ID })) });
    for (const [columnIndex, column] of columns.entries()) {
      await tx.column.create({
        data: {
          id: column.id, name: column.name, boardId: DEMO_BOARD_ID, position: columnIndex,
          cards: {
            create: column.cards.map(([title, description, priority, tags, assigneeIds], index) => ({
              id: `${column.id}-${index + 1}`, title, description, priority, tags,
              assignments: { create: assigneeIds.map((assigneeId) => ({ assigneeId })) },
              position: (index + 1) * POSITION_STRIDE,
            })),
          },
        },
      });
    }
  });
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
