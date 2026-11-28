# Architecture

The pnpm workspace contains a React/Vite SPA, a NestJS HTTP and Socket.IO API, and shared Zod contracts and ordering math. Prisma persists data in local PostgreSQL. Vite proxies HTTP and Socket.IO requests to the loopback API. UI components own colocated CSS Modules and use global design tokens. The board pairs Fraunces headings with DM Sans text and uses distinct column tones over a warm background. Column, priority and tag colors are shared between the board and card detail surfaces.

Card contracts carry assignee IDs in an array. PostgreSQL stores assignments in a join table, and the API validates board membership before updating assignments in the card transaction. The migration backfills existing assignments before removing the original column.

## Identity and access

NestJS sends six-digit codes through SMTP. PostgreSQL stores an HMAC of each code with an expiry and a retry count. Per-IP and per-address rate limits apply before requesting or verifying a code. A successful check consumes the code and creates a session with a random token. Only its digest is stored in PostgreSQL. Browsers use an HttpOnly, SameSite=Strict cookie with Secure on HTTPS. The API rejects writes from origins other than the configured frontend and returns no-store responses.

Profiles use a stable account ID and a unique, normalized email. Uploaded avatars are limited to PNG bytes and dimensions. The client converts selected photos into a bounded PNG preview. Profile images are returned to their owner. Card assignee initials and display names are limited to the board.

The workspace owns the shared header and the persistent board sidebar. The active board renders its sync and preference controls into that header while retaining its own query cache. The sidebar exposes the current board in the board list and keeps its expanded state local to the workspace. At widths up to 650 pixels, the collapsed sidebar stays beside the board and the expanded sidebar overlays it.

Read checks run against ownership or membership. Card writes check the board and role inside the same transaction as the change. The owner count and the shared membership count serialize on the affected account. New boards use four ordered columns with independent IDs. The existing board starts without an owner and is claimed only by the configured verified email.

The WebSocket server checks the request origin and session before joining a board room. Before each delivery it checks that each recipient still has an active session and board membership. Membership changes request a fresh snapshot and evict unauthorized sockets. Signing out revokes the server session and disconnects its sockets.

## Interfaces

| Operation | Contract |
| --- | --- |
| GET /boards/:id | Consistent snapshot with board revision, assignees, ordered columns and cards |
| POST /boards/:id/cards | `columnId`, card fields, and optional client-generated UUID `id`. Returns the committed change or null when replaying an accepted ID |
| PATCH /boards/:id/cards/:cardId | Card fields and `expectedVersion`, returns the committed change |
| PATCH /boards/:id/cards/:cardId/move | `targetColumnId`, `beforeCardId`, `expectedVersion`, returns the change or null for a no-op |
| DELETE /boards/:id/cards/:cardId | `expectedVersion` query parameter, returns the committed deletion |

`board:join` acknowledges that the socket is subscribed. The authenticated server emits `card:created`, `card:updated`, `card:moved` and `card:deleted` with the same change payload returned over HTTP. Each change carries its board ID, revision, changed cards and deleted card IDs. `x-socket-id` suppresses the sender's echo when the socket is in the board room.

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

The browser stores presentation preferences in local storage. Filter state and the suggestions derived from the board are local to the current view. Desktop and mobile use the same search input and suggestion logic. At widths up to 650 pixels CSS fixes the toolbar at the bottom and reveals the search panel at the top on demand, keeping the field clear of the software keyboard.

The saved view preference selects the grid or the grouped list. Both render the same memoized filtered columns, card summaries, draft composer and card dialog. The list uses native row buttons and status sections. At widths up to 600 pixels it hides description and tag previews and uses a distinct priority icon for each level. Row buttons include the priority and tags in their accessible description. The grid owns drag and drop.

Board lanes use a fixed maximum width and scroll horizontally when necessary. The Board preview and drag overlay share the same fixed default height, and the full-description preference sets a minimum height and allows expansion. Board previews place the priority bar above the title and include its label in the card button's accessible description. List previews keep priority in the metadata row. Both views reserve space for any visible sync or assignee indicators and use the remaining metadata width for tags. A resize observer recomputes the visible tags and overflow count when the available width or the tag sizes change.

Private snapshots and pending writes stay in account- and board-scoped memory. The service worker caches the app shell and its assets. The client removes the legacy offline keys on startup. Create receipts persist the client UUID in the same transaction as the card and survive deletion, so an ambiguous response cannot duplicate or resurrect a card.

Normal card selection uses the board and card IDs in the URL. For older URLs that contain only a card ID, an authenticated link endpoint looks up its board after checking access. Existing slugs are ignored and removed from the address once resolved. Opening a card adds an entry to the browser history. Closing a direct link or clearing an unavailable card replaces the current entry.

The copy button keeps tooltip feedback local to the card dialog and announces the copy result through a live status region.
