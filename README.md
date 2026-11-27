# Realtime Sprint Board

A collaborative Kanban board with private workspaces, accessible drag and drop, instant filters, optimistic moves and live updates across browser tabs. The optional seed creates a board with four columns and twelve engineering cards.

## Run locally

Requires Node.js 24, Corepack and Docker Compose.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
docker compose --profile mail up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Before starting the app, set `AUTH_CODE_SECRET` in `.env` to a unique random secret from `openssl rand -hex 32`. Set `LEGACY_BOARD_OWNER_EMAIL` to the address that should receive the seeded or existing board. Open the [local mailbox](http://localhost:8025) to read the sign-in code. The local mailbox and SMTP listener bind to loopback. For deployment, configure the HTTPS `APP_ORIGIN`, an SMTP relay and sender, and the owner email. Use the same public origin for the frontend, HTTP API and WebSocket proxy.

Open [localhost:5173](http://localhost:5173). Open a second tab to see edits and moves synchronize. Drag a card from anywhere on its surface. With the card focused, press Space to pick it up, use the arrow keys to move, and press Space or Enter to drop or Escape to cancel. Click or press Enter to open the card. Use **Copy link** to share a direct link to the open card. Use the plus button in a column to create a card inline. Enter a title, then leave the field or press Enter to create the card. Open the new card to edit its details.

The PostgreSQL volume keeps your changes across restarts. The seed skips an existing demo and preserves edits. See `.env.example` for loopback server and database settings.

Switch between **Board** and **List** from the toolbar. The list groups cards by status and uses the same search, filters, and card links.

### Try a concurrent edit

[Watch the two-tab demo](docs/concurrent-edit.webm).

1. Open the same card in two tabs. Start editing its description in both and enter different text.
2. Save in the first tab with Ctrl or Command plus Enter, then save in the second tab. The second tab keeps your draft and shows the saved description.
3. Choose **Keep current** to discard the draft or **Apply my draft** to save it. Watch the card update in the other tab when you apply it.

### Upgrade an existing board

Sync pending offline drafts in the old app before upgrading. Apply the migration to the existing database and sign in using the configured owner email. Existing cards, assignments, and links remain valid. Private boards require an online session and the new app clears legacy offline data. Owners can invite an address from **Members**. The invitation appears in the recipient’s workspace after sign-in.

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
