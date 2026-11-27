# Testing strategy

CI runs ESLint, TypeScript, builds and critical-path coverage. Use Vitest for shared logic and the web app, and Jest with a real PostgreSQL service for the NestJS API. Each suite enforces at least 75% line coverage on its designated critical modules.

| Area | Critical behavior |
| --- | --- |
| Shared | Empty, edge and middle positions, exhausted precision and rebalancing |
| API | Concurrent version conflicts, multiple assignees and board membership, ordered moves, rebalance changes, committed room broadcast and sender exclusion |
| Web | Derived filters, keyboard transitions, optimistic patch and rollback, revision gaps and reconnection |

Avoid coverage targets for static markup, CSS, generated Prisma code and library internals. Manually test the full keyboard drag with focus and screen reader announcements. In two browser tabs, create, edit, move and delete cards, verify a stale edit returns 409, and reconnect one tab after changes in the other. In React DevTools Profiler, verify that cards still visible after filtering or opening the modal skip unnecessary presentation renders.

For concurrent text editing, open the same field in two tabs and save different values. Verify the second editor retains its draft, shows the saved value, and leaves the persisted value intact until the person chooses **Apply my draft**. Repeat with **Keep current** and verify it issues no write. Change the field a third time during review and verify the review shows the new saved value. Cover both title and description, including blur and keyboard saves.

For offline work, load the production build once, pause sync, create a card, edit its description, and reopen the board with the browser offline. Check that changes are still present, then reconnect and choose **Resume sync**. Verify field merges, conflicting drafts and edits to remotely deleted cards. Simulate losing a create response after the server commits, then replay and verify the original card exists exactly once.

In conflict review, verify the full card opens from the sync control, only conflicting fields show comparisons, and shared text stays unhighlighted. Use a narrow viewport to check both versions remain readable. On the board, hover over a pending card's alert icon or focus the card with the keyboard to check the tooltip.

For card links, open a card from the board with the keyboard, then use Back and Forward and verify the URL and focus. Repeat from search, reload the dialog, and paste its link into a new tab. Move and rename the card from a second tab and verify the old link still opens it. From the pasted link, close the dialog and check that the board stays open. Check clipboard success and simulate denied access to verify that focus moves to the selected manual-copy field. Delete an open linked card from another tab and verify the board shows a notice and cleans the address. With the production shell and a snapshot cached, reopen a saved card link offline. Check that a locally created card offers copying once its creation syncs.

Check that hovering or tabbing to the link icon shows **Copy link**. Copy and keep the pointer over the icon to verify **Copied!** disappears on its own. Hover again to restore the tooltip.
