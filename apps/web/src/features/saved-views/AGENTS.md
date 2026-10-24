# Saved views

## What it is

Reusable named filter definitions. The first consumer is main Tasks; the generic feature does not interpret consumer configuration.

## Start here

- `core/saved-view.ts`: resource vocabulary, without transport or UI types.
- `context/saved-views-source.ts`: injectable read/write contract.
- `queries/saved-views.ts`: GraphQL live reads, cursor paging, and authoritative writes.
- `primitives/create-saved-view-draft.ts`: confirmed baseline versus temporary edits.
- `components/`: props-only list, shared padded context/overflow actions, and create/duplicate/rename/share dialogs.

## Boundaries

- Keep Task filters, scope, navigation, and configuration decoding in `features/tasks-view`.
- Do not migrate CRM's legacy personal views or team settings into this consumer.
- Share definitions, not access to their matching entities; the backend owns authorization.
- Rebuild loaded cursor chains after confirmed membership changes; never invent permission state or splice a full page.
- Keep consumer edits on failed saves; only confirmed writes replace the baseline.
- Validate the response viewer before exposing cached reads after an account change.

## Checks

Run from `apps/web`:

- `bun run test src/features/saved-views src/features/tasks-view`
- `bun run type-check`
- `bunx playwright test --config src/features/tasks-view/browser-test/saved-views.playwright.config.ts`
- `bun run gen-graphql` after schema or document changes.

## Related

- `docs/design/saved-views.md` at the repository root.
- `docs/architecture/frontend-features.md` and `docs/guides/add-graphql-field.md`.
