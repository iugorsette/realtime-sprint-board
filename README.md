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

Open [localhost:5173](http://localhost:5173). Open a second tab to see edits and moves synchronize. Drag a card from anywhere on its surface. With the card focused, press Space to pick it up, use the arrow keys to move, and press Space or Enter to drop or Escape to cancel. Click or press Enter to open the card. Use the plus button in a column to create a card inline. Add a title and any other fields, then leave the draft or press Enter in the title field to save.

The PostgreSQL volume keeps your changes across restarts. The seed skips an existing demo and preserves edits. See `.env.example` for loopback server and database settings.

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
