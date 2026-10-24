# Tasks view

## Scope

Main Tasks and reusable task-list hosts. Projects and CRM embed `TasksViewProvider`; only `TasksView` mounts saved-view sources.

## Start here

- `tasks-view-context.tsx`: filter state, router integration, and list source ownership.
- `filters/task-saved-view.ts`: strict versioned capture, decode, and materialization.
- `primitives/create-task-saved-views.ts`: transient drafts, explicit saves, conflicts, and navigation lifecycle.
- `views/task-saved-views.tsx`: sidebar/mobile selection, metadata editing, and management.
- `queries/use-tasks-query.ts`: shared list, board, Gantt, and search filtering.

## Gotchas

- Keep saved filters separate from presentation and text search; capture implicit assignment/creator conditions as normal OR-valued person facets and capture open statuses.
- Preserve stable tag/property bindings when labels disappear, and fail closed on unsupported definitions.
- Resolve the semantic viewer token only when executing a filter; a selected fixed user stays fixed.
- Keep saved views on All Tasks with every restriction in editable facets; upgrade v1 scope to v2 person filters without a separate Scope control.
- Do not persist temporary saved-view filters in entry snapshots; detail navigation discards those edits but retains the saved-view ID.
- Pass saved-view state through the existing Tasks search codec; split URLs namespace it as `s0.tasks.savedView`.
- Keep embedded Project/CRM task consumers free of saved-view management.
- Show Save view before Filters only when built-in filters differ from defaults; exclude search and presentation from that comparison.
- Keep sidebar actions targeted to their own record; Rename and Share preserve unsaved filters, while Duplicate starts with a prefilled private copy.
- Honor confirmed deletion when the same account selects the target while deletion is pending; never apply completion to another account.

## Checks

Run from `apps/web`:

- `bun run test src/features/tasks-view`
- `bun run type-check`
- `bunx playwright test --config src/features/tasks-view/browser-test/saved-views.playwright.config.ts`

## Related

- `docs/agent-guide/tasks.md` and `docs/design/saved-views.md` at the repository root.
