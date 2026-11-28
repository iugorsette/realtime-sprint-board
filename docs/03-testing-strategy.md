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

For columns, verify that owner changes reach other tabs and that role checks reject writes by members. Race card creation against column deletion and verify that a successful card creation leaves both the card and its column intact. In Board and List, add, rename and delete a column with the keyboard. Apply a filter that hides the cards in a column and verify that deletion remains unavailable.

Check that new columns default to gray and that the keyboard can select all eight colors. Change just the color, reload, and verify it appears in Board, List and the card status controls. Reject colors outside the palette and stale color edits.

On desktop and mobile, verify that the workspace has a single header and shows the saved profile picture. Check that the sidebar is visible at both widths and its toggle works with the keyboard. Create and switch boards from the sidebar and verify that the selected board is marked as current. Use the sidebar to open membership management and check that Escape returns focus to its trigger.

For card links, open a card from the board with the keyboard, then use Back and Forward and verify the URL and focus. Repeat from search, reload the dialog, and paste its link into a new tab. Move and rename the card from a second tab and verify the old link still opens it. From the pasted link, close the dialog and check that the board stays open. Check clipboard success and simulate denied access to verify that focus moves to the selected manual-copy field. Delete an open linked card from another tab and verify the board shows a notice and cleans the address. Reopen while offline and verify private cards do not appear. Use a second account to verify a previously opened board does not transfer between sessions.

Check that hovering or tabbing to the link icon shows **Copy link**. Copy and keep the pointer over the icon to verify **Copied!** disappears on its own. Hover again to restore the tooltip.

Switch between Board and List with the keyboard and verify that status order, visible cards and filters agree. Reload and check that the selected view persists. At a narrow viewport, open and close a list row with the keyboard and check that focus returns to the row. Add a card from a status group, move it through the card dialog, and verify it changes groups. After disconnecting, confirm both views require a connection. Check that a card link opens in either view.

In Board and desktop List, check cards with two short tags and with several long tags. Verify that cards show all tags when they fit and show the correct overflow count otherwise. Check cards with two, three, and four assignees. The first two cases show every avatar, and the last shows two avatars and **+2**.

Check that List rows stay on one line on desktop and mobile. Resize below 600 pixels and check that the priority icon replaces the text, the title gains space, and description and tags remain available in the card dialog. Resize back to verify desktop previews return.

In Board, verify that cards with short and long content use the same preview dimensions within the same viewport. Open a card to read its full content, then enable full descriptions and verify the long preview expands. Verify that the priority bar sits above the title on every column and fills one to four segments by level. Check that the priority name is available on hover and in the card button's accessible description.

At a narrow viewport, scroll the board and verify the bottom toolbar stays available. Open search from its icon, check input focus, choose a suggestion, and verify the card opens. Reopen search and use Done to check that the query remains applied when the input closes. Open filters from the bottom toolbar and verify the desktop input and inline filters remain available on wider screens.
