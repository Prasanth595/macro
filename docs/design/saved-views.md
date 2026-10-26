# Saved views: reusable storage, Tasks first

**Status:** Approved design, implemented on the task-saved-views branch. The
starting point below describes the code before this change; rollout requires
the additive migrations and backend GraphQL schema before the frontend.

## Goal and scope

A saved view is a named, reusable filter definition. Opening it queries live
entities using the current viewer's access, rather than restoring a snapshot of
results. The backend and CRUD client are reusable; the first UI consumer is the
main Tasks screen.

### Agreed behavior

| Concern | Decision |
| --- | --- |
| Ownership | Personal by default; one creator owns the view. |
| Sharing | An optional team share makes the definition discoverable to current teammates. |
| Item access | Sharing never grants access to matching entities. |
| Management | Only the owner can rename, update, delete, share, or unshare. |
| Relative people | “Me” means the current viewer; explicitly selected people remain fixed. |
| Contents | Filters only, including implicit assignment or creator conditions. No search text, layout, sorting, grouping, or scroll state. |
| Editing | Explicit Save changes, Reset, and Duplicate. |
| Navigation | Leaving discards temporary edits without a confirmation prompt. |
| Creation | The section's icon-only `+` starts an unsaved view; configure before creating. |
| Capture | Save view appears left of Filters when filters differ from the built-in defaults. |
| Mobile | Shared pill tab after the built-in tabs, with full creation, browsing, editing, and management support. |
| Initial surfaces | Main Tasks only; not project or CRM embedded task lists. |
| Owner departure | Team sharing stops while the owner is absent and resumes if they rejoin the shared team. |

No saved-view defaults, ordering customization, individual recipients, public
links, presentation settings, new task filter categories, or CRM migration are
included. In particular, the current Tasks implementation has no due-date filter;
this feature does not add one.

## Starting point before this change

- [`saved_views`](../../crates/saved_views/src/lib.rs) already stores `id`,
  `user_id`, `name`, arbitrary JSON `config`, and timestamps in `saved_view`.
  Configuration is explicitly consumer-owned.
- [Its PostgreSQL adapter](../../crates/saved_views/src/pgsql.rs) previously
  implemented personal CRUD with shallow-merge PATCH. Ownership checks lived in
  the [DSS REST adapter](../../services/document_storage_service/src/api/saved_views.rs).
  This change moves policy into the domain service and adds GraphQL operations.
- [CRM personal views](../../apps/web/src/features/crm/queries/saved-views.ts)
  use this storage. CRM team views instead live in team CRM settings, and CRM
  share links encode configuration snapshots. Preserve those existing contracts.
- [Tasks state](../../apps/web/src/features/tasks-view/types.ts) mixes filters
  with presentation and navigation state. Do not persist that entire object.
- [Task query construction](../../apps/web/src/features/tasks-view/queries/task-query.ts)
  and [client predicates](../../apps/web/src/features/tasks-view/filters/task-predicates.ts)
  both apply tab scope and facets. My Tasks adds a viewer-relative assignee
  condition; Created by me adds a viewer-relative creator condition. All Tasks
  does not add a team-ID restriction.
- [Tags](../../apps/web/src/features/soup/filters/facets/tag-facet.ts) currently
  require loaded tag metadata to resolve an option to its property definition.
  An unresolved tag stops filtering today. Saved views must not inherit that
  silent broadening behavior.

## Architecture

```text
Tasks UI
  -> Tasks filter-definition adapter
  -> reusable saved-view queries and draft behavior
  -> generated GraphQL client
  -> GraphQL saved-view adapter
  -> saved_views domain service
       -> saved-view storage port
       -> Teams membership port

Opening a definition
  -> Tasks filter-definition adapter
  -> existing Task query builder and client predicates
  -> existing GraphQL Soup queries and authorized entity sources
```

The saved-view service manages definitions, not result sets. It does not become
another search service or execute a second filter language. Saved views are not
new Soup entities and do not need app-wide favorites, properties, or document
sharing machinery.

Refactor the existing `saved_views` crate in place into domain models, ports,
service, and PostgreSQL adapter. Put authorization and write policy in the
service. Both the existing REST adapter and a new GraphQL adapter call it.
Transport handlers must not retain independent owner or membership policy.

Keep separate create, update, and delete mutation hooks and draft behavior in
`features/saved-views`. Keep `useSavedViews` (paginated list) and `useSavedView`
(single definition) independent and compose them in the host. The Task draft
controller receives only the detail source; mutation dialogs receive a refresh
callback, not both query sources. Compose the list through compound components
and reuse styled menu items across its context and overflow menus. Open focused
create, rename, share, and delete dialogs through the shared imperative dialog
system; action dialogs own mutations and render presentational forms or a delete
confirmation. Duplication reuses creation with a prefilled private copy. Keep Task
filters, filter summaries, navigation, and rendering in `features/tasks-view`;
the Task draft controller must not own generic
CRUD or dialog state. Bind asynchronous completion to its originating draft and
account rather than a navigation counter. Do not make the generic feature import
Tasks or CRM components.

## Stored filter contract

### Generic resource

Keep the existing JSON `config` column. New consumers use a versioned envelope:

- `kind`: a stable consumer identifier, initially `tasks`.
- `version`: the consumer's definition version, initially `1` for Tasks.
- `filters`: that consumer's declarative filter definition.

The backend validates generic write bounds and stores the configuration without
interpreting Task fields. It can filter lists by `config.kind`. The consumer owns
a versioned reader that applies supported Task filters and reports skipped conditions.
Existing CRM configurations do not gain mandatory new fields or undergo a rewrite.

This intentionally stores a consumer-owned definition rather than a fully
compiled Soup AST. A compiled AST bakes in the current user, requires reverse
parsing to restore editable controls, and couples persisted definitions to query
transport details. Reuse the existing compiler at execution time instead.

### Task definition v1

The proposed shape below uses explanatory UUID placeholders, not real IDs:

```json
{
  "kind": "tasks",
  "version": 1,
  "filters": {
    "statusOptionIds": ["<in-progress-option-uuid>"],
    "priorityOptionIds": [],
    "assignees": [{ "type": "viewer" }],
    "creators": [{ "type": "user", "id": "macro|example@example.com" }],
    "tags": [{
      "propertyDefinitionId": "<tag-property-uuid>",
      "optionId": "<tag-option-uuid>"
    }]
  }
}
```

- Save My Tasks by adding a viewer reference to Assignee; save Created by me by
  adding one to Created by. All Tasks adds neither. There is no separate Scope
  control or persisted scope field.
- Person references are either `{ "type": "viewer" }` or
  `{ "type": "user", "id": "..." }`. The picker distinguishes the relative
  **Me** option from a fixed person. Do not replace every occurrence of the
  creator's ID with a viewer token.
- Within each facet, values are alternatives (OR). Different facets combine
  with AND. An empty facet adds no restriction.
- Persist stable status and priority option IDs, not display labels. Persist
  both tag IDs so inaccessible or deleted tag metadata cannot erase a clause.
- Capture the actual open-status selection when present. Do not depend on
  whatever default statuses a future client chooses.
- Capturing My Tasks with an additional assignee uses normal OR matching: tasks
  assigned to either person. Created by me follows the same rule for creators.
- Accept only this final definition format. Earlier experimental Scope-based
  configurations are not deployed contracts and have no upgrade path.

Materialization always uses the All Tasks tab and restores every restriction as
an editable facet. Viewer references resolve at query time. The same definition
must feed list, board, Gantt, client predicates, and temporary text-search
requests. Search text is not saved, but search results must satisfy every saved
filter. In particular, search must use stored tag bindings rather than silently
dropping tags absent from the viewer's metadata. If a search backend cannot
express a condition, block that search with an explicit unsupported state;
never run it with fewer conditions. Changing layout remains a local preference
and does not dirty the saved definition.

Apply supported conditions immediately, omitting unsupported or malformed entries
and conflicting tag bindings. Show a danger-colored banner above the results that
identifies skipped filter groups without an additional description. If no supported
conditions remain, show the unfiltered All Tasks list, including closed tasks;
unknown formats also show this list with the banner. Keep missing or unauthorized
definitions in the unavailable state, without executing task queries.

Reading never modifies the stored definition and never starts a recovery workflow.
Normal explicit Save changes and Duplicate actions remain available. Missing
person or tag labels retain their exact filter IDs because these conditions remain
executable. A missing authenticated viewer blocks relative-filter execution.

For dirty-state comparison, deduplicate and order set-valued filters. Reordering
a selection alone is not a change. One Task codec owns capture, validation,
materialization, and comparison; do not store both facets and an independently
editable compiled AST.

## Ownership, sharing, and lifecycle

A caller can read a definition when they own it, or when its effective team share
is valid and they currently belong to that team. Only the owner can write it.
The server derives the owner from the authenticated request, never from input.
Enabling sharing requires the owner to belong to the selected team. A viewer can
save a personal copy of another person's shared definition.

Every result query still uses the viewer's existing entity permissions. A shared
All Tasks view can include the viewer's private tasks; team sharing controls who
can open the definition, not which entities it selects.

### Sharing follows current membership

A share stores only a nullable `shared_team_id`. Both its owner and its viewer
must currently belong to that team. Owner-only writes and item permissions remain
independent of this visibility check.

Leaving immediately makes the share ineffective; rejoining the same team restores
it. A failed membership removal that restores membership has the same effect.
This follows the existing current-membership sharing pattern, replacing the
earlier proposed permanent-revocation policy. It needs no membership-lifetime
column or changes to Teams' join, removal, or compensation flows.

Unsharing explicitly clears `shared_team_id`. A deleted team makes the view
private, not deleted. When an owner is absent, API responses hide the ineffective
share without clearing the stored team association.

The Teams-owned `TeamRepository` supplies authoritative current memberships:
reuse `get_user_teams` for candidates and `current_members` for exact batched
checks through the saved-view membership adapter. Saved-view storage owns
definition persistence. Do not query or mutate
`team_user` directly from GraphQL resolvers or saved-view storage. Listing applies
visibility before its public pagination limit, with batched membership checks
rather than per-row service calls. Recheck the viewer alongside each owner in
that batch; the initial team list only narrows candidate selection.

## Persistence and GraphQL

Add an internal integer revision, starting at one, to `saved_view`. All writes,
including existing REST writes, advance it. Add owner and shared-team indexes
with stable created-time/ID ordering; keep optional kind filtering without
speculative kind-specific indexes. Existing rows remain private and retain their
configuration. Consolidate unpublished migrations into the minimum safe final
set, retaining separate concurrent-index statements and lock timeouts.

Expose reads under the authenticated `user`, following the
[GraphQL field guide](../guides/add-graphql-field.md):

| Operation | Contract |
| --- | --- |
| `user.savedViews` | Visible owned and shared definitions; optional kind filter and bounded cursor pagination. |
| `user.savedView(id)` | An authorized definition, or not found. |
| `createSavedView` | Stable client-generated ID, name, config, and optional team share; private by default. |
| `updateSavedView` | ID, expected revision, and optional name, replacement config, or explicit sharing change. |
| `deleteSavedView` | ID and expected revision; returns the deleted ID. |

The normalized output object has `id: ID!`, owner ID, name, config, effective
shared team ID, revision, and timestamps. Generate the GraphQL envelope types and
SDL; the frontend-owned JSON schema is not a second handwritten GraphQL DTO.

Updates distinguish omission from clearing. Omitted fields stay unchanged;
private sharing is explicit. A submitted config replaces the whole definition.
Retain legacy REST shallow-merge behavior through an explicit domain update
operation, rather than changing CRM's existing PATCH semantics.

Stale revisions return a terminal conflict and preserve the newer record. Keep
the draft so the user can reload or save a separate copy. Retried creation with
the same owned ID returns the existing resource without overwriting it; retried
deletion of an absent ID is harmless. A permanent ID-only tombstone prevents a
late create retry from resurrecting a deleted view. Keep physical deletion so
older REST readers still see absence, not an empty soft-deleted row. Serialize
create/delete in upgraded writers with the same per-ID transaction lock. The
deletion trigger captures old REST deletes and account cascades without taking
that advisory lock after its row lock. Creation rechecks tombstones after INSERT
and rolls back if a legacy deletion committed while INSERT waited. Tombstones
contain no names, filters, or owner foreign key, and must not be purged. GraphQL
permission, conflict, and validation errors must not become transport retries
that block the mutation queue.

Return authoritative records from create/update and the deleted identity from
delete. Reconcile affected collection membership in the shared GraphQL cache;
normalizing a record alone does not insert or remove connection edges. Preserve
cursor-page boundaries when inserting, removing, or moving a record between
kind-filtered collections, including when the first page is full. Do not
optimistically invent sharing permission. Use the established live-query and
mutation-policy machinery, not a second TanStack persistence path for Tasks.

Mutation responses use primary-backed data. Membership evidence also requires
authoritative reads, not a stale replica or browser cache. Revalidate collections
on opening/foregrounding the surface. V1 does not introduce a dedicated realtime
subscription; cross-client changes appear on revalidation. Every server operation
still checks current access, irrespective of cached UI state.

## UI and navigation

### Desktop

Add a **Saved views** section to `TasksSidebar`, after the built-in navigation.
Keep the heading and its accessible, icon-only `+` available when the section is
empty, collapsed, loading, or in an error state. Rows show the name, active state,
and a team-sharing indicator where applicable. Use the existing sidebar and
control primitives.

The main pane displays the selected view's name with its overflow menu immediately beside it, plus the normal Task controls.
Provide matching sidebar context/overflow and selected-view overflow menus with
separate Rename and Share actions, Duplicate, Copy link, and confirmed Delete.
Wrap menu items in the existing padded groups. Non-owners get only actions they
can perform; backend enforcement remains authoritative. Rename and Share update
metadata only, preserving temporary filters without saving them.

Show **Save view** immediately left of Filters when the current filters differ
from the built-in tab defaults. It captures structured filters and implicit person conditions,
excluding search. Show a short reminder when search is active so the saved
definition is not mistaken for the visible search results.

### Drafts and explicit saving

- `+` starts a transient New view with no person restrictions and the normal
  open-status filters. Nothing is persisted until Save view succeeds.
- Reuse the Task filter controls to configure it. Saving requests a name and
  optional team sharing. Cancel restores normal navigation without persistence.
- Opening a saved view replaces the prior filter scope rather than intersecting
  with the previously selected built-in tab. Clear unrelated text search.
- Changes show Save changes and Reset for the owner. All viewers can Duplicate
  with a prefilled “(copy)” name; copies are private unless explicitly shared.
  Duplicating the selected view includes temporary filters; duplicating another
  sidebar view uses that view's saved definition. Other viewers cannot overwrite
  the shared definition.
- Only a confirmed write updates the saved baseline. Failures keep the draft and
  its inputs. Leaving the view discards temporary filters, including when a
  background save fails after navigation.
- Task-detail navigation and its return breadcrumb retain the originating saved
  view identity, but do not persist an unsaved filter draft. Scope async results
  to the account, selected view, and revision before installing them. A confirmed
  deletion also exits its target if the same account selected it during the request.

### Mobile

Tasks currently has navigation pills and a filter drawer, not a mobile sidebar.
Add a Views picker using the shared `MobileDrawer`; include the named list,
active saved-view name, and the section's `+`. Preserve the built-in navigation
and existing mobile list-only behavior.

Show Save view left of the mobile filter trigger under the same changed-filter
condition. Provide management through each saved-view row's visible overflow
button and the overflow menu beside the selected view's name. Use existing dialog/drawer
conventions for naming, sharing, conflicts, and delete confirmation. Keep row
menus inside the drawer's portal scope for keyboard access. Finish drawer closure
and restore its trigger focus before opening an action's dialog. Discard queued
actions when the account changes. No hover-only controls or desktop-only
management actions.

### URLs and unavailable views

Extend the Tasks route/search codec with a stable `savedView` ID, for example
`/app/component/tasks?savedView=<uuid>`. Links identify the stored definition;
they do not serialize filters or bypass sharing. A private link stays private.
Preserve the normal Task-detail route composition and split behavior.

A missing, deleted, unshared, or inaccessible view shows an unavailable state
with a return-to-Tasks action. Do not fall back to All Tasks under the saved
view's name. A list failure retains already loaded rows with a retry action.
Unsupported or malformed filter conditions are skipped with the danger banner;
if none apply, show unfiltered tasks. Duplication warns before saving a copy that
omits these conditions and leaves the original unchanged.
Keep the banner concise: name the skipped filter groups without a description.
Owners can explicitly choose **Remove & save** at its right edge.
This revision-checked update keeps supported stored conditions and sharing unchanged;
it does not save temporary filter edits. Failed writes retain the warning and stored
definition, and conflicts offer a reload. Only a confirmed update clears the warning.

## Delivery and review boundaries

Implement in focused slices, with behavior checks alongside each slice:

1. Versioned Task definition codec and generic saved-view domain/storage design;
   additive team-sharing and revision migrations with current-membership checks.
2. GraphQL adapter, viewer reads, service wiring, generated contracts, and mutation
   cache policy. Preserve existing REST/CRM behavior.
3. Reusable frontend queries/drafts and the main Tasks desktop/mobile integration.
   Keep project and CRM embedded Task consumers unchanged.
4. Update the Tasks agent guide and affected crate guidance; exercise permissions,
   multiple viewers, revision conflicts, missing filters, and navigation in the
   local app before rollout.

Deploy the additive database changes and upgrade all backend writers before
enabling the frontend consumer, so concurrent REST writes advance revisions.
Do not add a REST fallback when the new schema is unavailable. Reuse existing
tracing across writes and filter loading without logging names, configuration
contents, or person identifiers.

### Points for design review

- Consumer-owned, versioned filter definitions are recommended over storing a
  compiled Soup AST or the entire Task view state.
- Team visibility follows current owner and viewer membership, matching existing
  sharing patterns rather than introducing membership lifetimes.
- Cross-client changes revalidate rather than using a new realtime subscription.
- No existing CRM views are migrated or reinterpreted in this feature.
