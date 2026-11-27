# Realtime Sprint Board

A collaborative Kanban board with accessible drag and drop, instant filters, optimistic moves and live updates across browser tabs. The local demo opens a board with four columns and twelve engineering cards.

## Run locally

Requires Node.js 24, Corepack and Docker Compose.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [localhost:5173](http://localhost:5173). Open a second tab to see edits and moves synchronize. Drag a card from anywhere on its surface. With the card focused, press Space to pick it up, use the arrow keys to move, and press Space or Enter to drop or Escape to cancel. Click or press Enter to open the card. Use **Copy link** to share a direct link to the open card. Use the plus button in a column to create a card inline. Enter a title, then leave the field or press Enter to create the card. Open the new card to edit its details.

The PostgreSQL volume keeps your changes across restarts. The seed skips an existing demo and preserves edits. See `.env.example` for loopback server and database settings.

### Try a concurrent edit

[Watch the two-tab demo](docs/concurrent-edit.webm).

1. Open the same card in two tabs. Start editing its description in both and enter different text.
2. Save in the first tab with Ctrl or Command plus Enter, then save in the second tab. The second tab keeps your draft and shows the saved description.
3. Choose **Keep current** to discard the draft or **Apply my draft** to save it. Watch the card update in the other tab when you apply it.

### Work offline

Open **Live sync** and choose **Work offline**. Create cards and edit titles and descriptions. Changes stay in this browser, and **Resume sync** sends them once you are connected. Review a conflict when the same field changed on the server.

To test reopening without a connection, run `pnpm build` and open `pnpm --filter @board/web exec vite preview` while the API is running. Load the board once on that origin so the browser can cache the app and the board. Close and reopen the preview URL while offline to verify pending changes survive.

## Verify

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm test:cov
```

The API tests need a running, migrated PostgreSQL database. They create and remove isolated test boards.

## Engineering docs

- [Business rules](docs/01-business-rules.md) explain card ordering, version conflicts and keyboard behavior.
- [Architecture](docs/02-architecture.md) documents HTTP and socket contracts and optimistic reconciliation.
- [Testing strategy](docs/03-testing-strategy.md) defines critical coverage and manual validation.
- [Post-MVP roadmap](docs/04-post-mvp-roadmap.md) records the delivered MVP and tracks subsequent releases.
