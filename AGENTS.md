# Engineering guide

Read [Business rules](docs/01-business-rules.md) and [Architecture](docs/02-architecture.md) before changing a feature. Update both when the contract changes and use the [testing strategy](docs/03-testing-strategy.md) to choose regression cases.

Use English for all repository content and UI strings. Use strict TypeScript, inferred Zod DTOs, and no explicit `any`. Keep API controllers and the socket gateway thin. Keep database writes in the service and publish committed changes outside transactions.

Write functional React components. TanStack Query owns server data. Keep filter controls, form drafts and drag state local. Derive visible cards with `useMemo` and memoize presentational cards with stable props. Use CSS Modules alongside components, tokens in `styles/tokens.css`, and minimal base and focus rules in `styles/global.css`. Prefer native controls and preserve keyboard and screen reader behavior.
