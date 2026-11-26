# Architecture

The pnpm workspace contains a React/Vite SPA, a NestJS HTTP and Socket.IO API, and shared Zod contracts and ordering math. Prisma persists data in local PostgreSQL. Vite proxies HTTP and Socket.IO requests to the loopback API. UI components own colocated CSS Modules and use global design tokens.

## Interfaces

| Operation | Contract |
| --- | --- |
| GET /boards/:id | Consistent snapshot with board revision, assignees, ordered columns and cards |
| POST /cards | `columnId` and card fields, returns the committed change |
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

TanStack Query owns the board snapshot. Local state owns filter selections, modal drafts, the active drag and connection status. Filter projections retain card references. Sortable handles subscribe to drag context independently of presentational card bodies.
