# Tasks view

## Scope

Main Tasks and reusable task-list hosts. Projects and CRM embed `TasksViewProvider`; only `TasksView` mounts saved-view sources, without a feature-local GraphQL provider.

## Start here

- `tasks-view.tsx` and `tasks-view-context.tsx`: independent saved-view list/detail query composition, filter state, router integration, and task-list source ownership.
- `filters/task-saved-view.ts`: strict versioned capture, decode, and materialization.
- `primitives/create-task-saved-views.ts`: one selection-state union, task filter drafts, and scoped completion checkpoints; receives only the detail source, without list, mutation, or dialog state.
- `views/task-saved-views.tsx`: compound sidebar/mobile lists, filter summaries, direct imperative action dialogs, and the inline save hook.
- `queries/use-tasks-query.ts`: shared list, board, Gantt, and search filtering.

## Gotchas

- Keep saved filters separate from presentation and text search; capture implicit assignment/creator conditions as normal OR-valued person facets and capture open statuses.
- Preserve stable tag/property bindings when labels disappear, and fail closed on unsupported definitions.
- Resolve the semantic viewer token only when executing a filter; a selected fixed user stays fixed.
- Keep saved views on All Tasks with every restriction in editable facets; accept only the final v1 person-filter format, without a separate Scope control.
- Do not persist temporary saved-view filters in entry snapshots; detail navigation discards those edits but retains the saved-view ID.
- Pass saved-view state through the existing Tasks search codec; split URLs namespace it as `s0.tasks.savedView`.
- Keep embedded Project/CRM task consumers free of saved-view management.
- Show Save view before Filters only when built-in filters differ from defaults; exclude search and presentation from that comparison.
- Keep sidebar actions targeted to their own record; Rename and Share preserve unsaved filters, while Duplicate starts with a prefilled private copy.
- Keep the selected-view overflow menu beside its name on desktop and mobile; keep draft save/reset actions separate.
- Place the saved-view picker after built-in mobile tabs and use the shared pill button for its trigger.
- Close the selected-view menu before opening a dialog, discard deferred actions after account or selection changes, and close dialogs after account, saved-view, or built-in-tab navigation.
- Keep mobile action dialogs owned outside the drawer so closing its content does not dispose the dialog.
- Honor confirmed deletion when the same account selects the target while deletion is pending; never apply completion to another account.
- Keep malformed mutation responses separate from selected-view availability, preserve ordinary-create facets, and reject creation completions after the selected revision changes.
- Keep invalid definitions non-executable; show authorized stored filters and issues, and recreate only through an explicit separate draft without modifying the original.

## Checks

Run from `apps/web`:

- `bun run test src/features/tasks-view`
- `bun run type-check`

## Related

- `docs/agent-guide/tasks.md` and `docs/design/saved-views.md` at the repository root.
