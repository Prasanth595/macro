# Saved views

## What it is

Reusable named filter definitions. The first consumer is main Tasks; the generic feature does not interpret consumer configuration.

## Start here

- `core/saved-view.ts`: resource vocabulary, without transport or UI types.
- `context/saved-views-source.ts`: independent list and detail read contracts.
- `queries/saved-views.ts`: `useSavedViews` for cursor paging and `useSavedView` for one definition; compose them at the host.
- `primitives/create-saved-view-draft.ts`: confirmed baseline versus temporary edits.
- `queries/saved-view-actions.ts`: independent create, update, and delete hooks using the shared GraphQL client, native mutation state, authoritative confirmation, and cursor reconciliation.
- `views/saved-view-dialogs.tsx`: action dialogs own mutation hooks, dialog shells, and lifetime checks.
- `components/`: presentational forms/confirmation, compound list, shared styled context/overflow items, and mobile picker.

## Boundaries

- Keep Task filters, navigation, and configuration decoding in `features/tasks-view`.
- Do not migrate CRM's legacy personal views or team settings into this consumer.
- Share definitions, not access to their matching entities; the backend owns authorization.
- Rebuild loaded cursor chains after confirmed membership changes; never invent permission state or splice a full page.
- Keep consumer edits on failed saves; only confirmed writes replace the baseline.
- Mount picker menus inside the drawer portal scope, close menus before opening dialogs, then close the drawer and restore focus before opening another dialog.
- Render the mobile picker trigger with the shared pill button and preserve the selected state supplied by its consumer.
- Bind deferred picker actions to the opening account and discard them after an account change.
- Validate the response viewer before exposing cached reads after an account change.
- Keep list and detail hooks independent; pass mutation dialogs a refresh callback, not an aggregate read source.
- Resolve mutation clients with `getGraphqlSoupClient` inside reactive options; do not require a feature-local `UrqlProvider`.

## Checks

Run from `apps/web`:

- `bun run test src/features/saved-views src/features/tasks-view`
- `bun run type-check`
- `bun run gen-graphql` after schema or document changes.

## Related

- `docs/design/saved-views.md` at the repository root.
- `docs/architecture/frontend-features.md` and `docs/guides/add-graphql-field.md`.
