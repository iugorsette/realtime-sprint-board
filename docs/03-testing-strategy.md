# Testing strategy

CI runs ESLint, TypeScript, builds and critical-path coverage. Use Vitest for shared logic and the web app, and Jest with a real PostgreSQL service for the NestJS API. Each suite enforces at least 75% line coverage on its designated critical modules.

| Area | Critical behavior |
| --- | --- |
| Shared | Empty, edge and middle positions, exhausted precision and rebalancing |
| API | Concurrent version conflicts, multiple assignees and board membership, ordered moves, rebalance changes, committed room broadcast and sender exclusion |
| Web | Derived filters, keyboard transitions, optimistic patch and rollback, revision gaps and reconnection |

Avoid coverage targets for static markup, CSS, generated Prisma code and library internals. Manually test the full keyboard drag with focus and screen reader announcements. In two browser tabs, create, edit, move and delete cards, verify a stale edit returns 409, and reconnect one tab after changes in the other. In React DevTools Profiler, verify that cards still visible after filtering or opening the modal skip unnecessary presentation renders.

For concurrent text editing, open the same field in two tabs and save different values. Verify the second editor retains its draft, shows the saved value, and leaves the persisted value intact until the person chooses **Apply my draft**. Repeat with **Keep current** and verify it issues no write. Change the field a third time during review and verify the review shows the new saved value. Cover both title and description, including blur and keyboard saves.

For private workspaces, verify code expiration, code reuse, throttling, session expiry and sign-out. Verify that an unrelated account cannot load board snapshots, resolve card links, change cards or join a board socket room. Check owner, editor and viewer permissions, immediate rejection of revoked access, concurrent ownership and membership limits, and profile image input validation.

On desktop and mobile, verify that the workspace has a single header and shows the saved profile picture. Use the board drawer to create and switch boards. Check keyboard focus after closing it, including Escape dismissal, and use the drawer to open membership management.

For card links, open a card from the board with the keyboard, then use Back and Forward and verify the URL and focus. Repeat from search, reload the dialog, and paste its link into a new tab. Move and rename the card from a second tab and verify the old link still opens it. From the pasted link, close the dialog and check that the board stays open. Check clipboard success and simulate denied access to verify that focus moves to the selected manual-copy field. Delete an open linked card from another tab and verify the board shows a notice and cleans the address. Reopen while offline and verify private cards do not appear. Use a second account to verify a previously opened board does not transfer between sessions.

Check that hovering or tabbing to the link icon shows **Copy link**. Copy and keep the pointer over the icon to verify **Copied!** disappears on its own. Hover again to restore the tooltip.

Switch between Board and List with the keyboard and verify that status order, visible cards and filters agree. Reload and check that the selected view persists. At a narrow viewport, open and close a list row with the keyboard and check that focus returns to the row. Add a card from a status group, move it through the card dialog, and verify it changes groups. After disconnecting, confirm both views require a connection. Check that a card link opens in either view.

In Board and desktop List, check cards with two short tags and with several long tags. Verify that cards show all tags when they fit and show the correct overflow count otherwise. Check cards with two, three, and four assignees. The first two cases show every avatar, and the last shows two avatars and **+2**.

Check that List rows stay on one line on desktop and mobile. Resize below 600 pixels and check that the priority icon replaces the text, the title gains space, and description and tags remain available in the card dialog. Resize back to verify desktop previews return.

In Board, verify that the priority bar sits above the title on every column and fills one to four segments by level. Check that the priority name is available on hover and in the card button's accessible description.

At a narrow viewport, scroll the board and verify the bottom toolbar stays available. Open search from its icon, check input focus, choose a suggestion, and verify the card opens. Reopen search and use Done to check that the query remains applied when the input closes. Open filters from the bottom toolbar and verify the desktop input and inline filters remain available on wider screens.
