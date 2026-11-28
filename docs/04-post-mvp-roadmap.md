# Post-MVP roadmap

## Delivered MVP

The delivered MVP is recorded at commit `3c12653` on the `MVP` branch. It includes the single-board Kanban demo, card creation and editing, accessible drag and drop, search and filters, browser preferences, live synchronization, concurrent edit review, and offline creation and text editing.

## Delivery workflow

Work on one feature at a time, with one branch and pull request per feature. Review the changes and pass CI before merging. Keep this roadmap current and update the business rules and architecture whenever a feature changes the contract. Update the testing strategy when a new regression check is needed.

## Feature sequence

1. **Card sharing.** Delivered in [PR #1](https://github.com/iugorsette/realtime-sprint-board/pull/1). Open saved cards by URL, retain selection on reload, and copy the link from the card dialog.
2. **List view.** Delivered in [PR #2](https://github.com/iugorsette/realtime-sprint-board/pull/2). Group cards by status and reuse board filters, search, and card links. The card priority bar followed in [PR #3](https://github.com/iugorsette/realtime-sprint-board/pull/3).
3. **Accounts and private boards** (`feat/accounts-private-boards`). Sign in with a one-time email code, edit a profile and upload an avatar, create private boards, and manage roles and invitations. This delivery enforces the five-owned and ten-joined limits and requires an online session for private boards.
4. **Rich descriptions.** Evaluate Tiptap, Lexical, and Slate for block-style editing. Compare cost and licensing, production bundle size, and lazy loading. Check migration of existing descriptions and effects on search, offline editing, and conflict review before choosing an editor.
