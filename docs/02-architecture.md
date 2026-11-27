# Architecture

The pnpm workspace contains a React/Vite SPA, a NestJS HTTP and Socket.IO API, and shared Zod contracts and ordering math. Prisma persists data in local PostgreSQL. Vite proxies HTTP and Socket.IO requests to the loopback API. UI components own colocated CSS Modules and use global design tokens. The board pairs Fraunces headings with DM Sans text and uses distinct column tones over a warm background. Column, priority and tag colors are shared between the board and card detail surfaces.

Card contracts carry assignee IDs in an array. PostgreSQL stores assignments in a join table, and the API validates board membership before updating assignments in the card transaction. The migration backfills existing assignments before removing the original column.

## Interfaces

| Operation | Contract |
| --- | --- |
| GET /boards/:id | Consistent snapshot with board revision, assignees, ordered columns and cards |
| POST /cards | `columnId`, card fields, and optional client-generated UUID `id`. Returns the committed change or null when replaying an accepted ID |
| PATCH /cards/:id | Card fields and `expectedVersion`, returns the committed change |
| PATCH /cards/:id/move | `targetColumnId`, `beforeCardId`, `expectedVersion`, returns the change or null for a no-op |
| DELETE /cards/:id | `expectedVersion` query parameter, returns the committed deletion |

`board:join` acknowledges that the socket is subscribed. The server emits `card:created`, `card:updated`, `card:moved` and `card:deleted` with the same change payload returned over HTTP. Each change carries its board ID, revision, changed cards and deleted card IDs. `x-socket-id` suppresses the sender's echo when the socket is in the board room.

```text
Drag -> Query cache: cancel snapshot request, snapshot board, patch preview
     -> HTTP API: PATCH move with card version and target anchor
     -> PostgreSQL: lock board, validate current inputs, commit cards + revision
     <- HTTP reply: apply change with queued events, ordered by revision
     -> Socket room (other tabs): patch caches directly
```

The board row lock serializes writes at demo scale. Read snapshots use repeatable read so cards and revision describe the same commit. A 409 restores the optimistic card, applies the authoritative card when available and refreshes the snapshot. Network errors also trigger a refresh because the server might have committed before the response was lost. Reserve one mutation per tab. Buffer socket events during a mutation or snapshot fetch. Discard events already represented by the cache. A revision gap triggers a snapshot, then newer buffered events are replayed. Rejoin and fetch on reconnect because missed messages may not be replayed by Socket.IO.

TanStack Query owns the board snapshot. Local state owns filter selections, inline drafts and pending field edits, the active drag and connection status. Filter projections retain card references. Draggable card wrappers subscribe to drag context independently of presentational card bodies.

The card details stay open during editing. A queue sends each field change against the latest known card version and applies list additions and removals individually. Status selection uses the same version-checked move endpoint as drag and drop. When a text edit reaches the front of the queue, it checks the original field value against the latest cached value. The inline editor keeps its draft on a mismatch or a failed save. It displays the committed field from the query cache and uses the value shown during review as the baseline for an explicit retry. The API still checks the card version to cover changes that arrive after the client check.

The full-viewport card dialog handles scrolling for tall content. The card surface grows with its contents. The compact tag picker places its button or input before the selected chips in the layout and tab order, and caps the width of the control at 18 rem. It anchors a wrapping panel of suggestions to the input outside the card layout and can flip the panel above the input on short viewports.

The browser stores presentation preferences in local storage. Filter state and the suggestions derived from the board are local to the current view.

The saved view preference selects the grid or the grouped list. Both render the same memoized filtered columns, card summaries, draft composer and card dialog. The list uses native row buttons and status sections. The grid owns drag and drop.

List rows reserve space for priority and any visible sync or assignee indicators, then use the remaining width for tags. A resize observer recomputes the visible tags and overflow count when the available width or the tag sizes change.

Browser storage holds the last committed board snapshot and a queue for submitted creates and text edits. A write enters the queue before its first network attempt. Web Locks serialize queue writes and replays across tabs on the same origin. While paused, a projection applies the pending changes over the cached server snapshot. The production service worker caches the built shell and assets so a previously loaded board can reopen offline.

On resume, the client reads an authoritative snapshot and uses the latest card version for writes. It compares a queued text value and its original value with the server field to recognize a previous success or surface a conflict. Replay acknowledges entries individually. Create receipts persist the client UUID in the same transaction as the card and board revision. The receipt survives card deletion so a lost response cannot produce a duplicate card or resurrect a deleted one.

Conflict review reuses the card dialog and shows the current snapshot as card context. Each affected field compares its local and server value, while the resolution handler still checks the exact value shown during review. Deleted cards use the snapshot stored with the draft.

Normal card selection uses the `cardId` query parameter and the browser History API. A selection made on the board adds a history entry. Closing a direct link or clearing an unavailable card replaces the current entry. History navigation restores a selection from the full TanStack Query board snapshot or its offline projection. The client checks for a missing card after a successful board refresh or a later cache update. The query parameter keeps the same SPA path, so the production service worker can serve the existing cached shell. The copied link uses the current origin and the same query parameter. Conflict review continues to use local sync state.

The `cardId` value is the persisted primary key. The optional `slug` reflects the title and is ignored during lookup. The MVP seed ID migration replaces the twelve legacy primary keys in one transaction and advances the board revision. Foreign keys cascade to assignments. The current seed uses the same UUIDs, and offline storage upgrades cached snapshots and pending text edits as it reads them. Apply the migration before serving the new frontend and reload existing tabs after the upgrade.

The copy button keeps tooltip feedback local to the card dialog and announces the copy result through a live status region.
