# Testing strategy

CI runs ESLint, TypeScript, builds and critical-path coverage. Use Vitest for shared logic and the web app, and Jest with a real PostgreSQL service for the NestJS API. Each suite enforces at least 75% line coverage on its designated critical modules.

| Area | Critical behavior |
| --- | --- |
| Shared | Empty, edge and middle positions, exhausted precision and rebalancing |
| API | Concurrent version conflicts, multiple assignees and board membership, ordered moves, rebalance changes, committed room broadcast and sender exclusion |
| Web | Derived filters, keyboard transitions, optimistic patch and rollback, revision gaps and reconnection |

Avoid coverage targets for static markup, CSS, generated Prisma code and library internals. Manually test the full keyboard drag with focus and screen reader announcements. In two browser tabs, create, edit, move and delete cards, verify a stale edit returns 409, and reconnect one tab after changes in the other. In React DevTools Profiler, verify that cards still visible after filtering or opening the modal skip unnecessary presentation renders.

For concurrent text editing, open the same field in two tabs and save different values. Verify the second editor retains its draft, shows the saved value, and leaves the persisted value intact until the person chooses **Apply my draft**. Repeat with **Keep current** and verify it issues no write. Change the field a third time during review and verify the review shows the new saved value. Cover both title and description, including blur and keyboard saves.
