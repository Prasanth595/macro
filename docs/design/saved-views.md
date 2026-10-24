# Saved views: reusable storage, Tasks first

**Status:** Proposed implementation design. Product decisions below are agreed;
no application code or migrations have been implemented.

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
| Contents | Filters only, including implicit scope. No search text, layout, sorting, grouping, or scroll state. |
| Editing | Explicit Save changes, Reset, and Save as new. |
| Navigation | Leaving discards temporary edits without a confirmation prompt. |
| Creation | The section's icon-only `+` starts an unsaved view; configure before creating. |
| Capture | A separate Save as view action captures the current filters. |
| Mobile | Full creation, browsing, editing, and management support. |
| Initial surfaces | Main Tasks only; not project or CRM embedded task lists. |
| Owner departure | Team sharing stops when the owner leaves and does not revive after rejoining. |

No saved-view defaults, ordering customization, individual recipients, public
links, presentation settings, new task filter categories, or CRM migration are
included. In particular, the current Tasks implementation has no due-date filter;
this feature does not add one.

## Current implementation

- [`saved_views`](../../crates/saved_views/src/lib.rs) already stores `id`,
  `user_id`, `name`, arbitrary JSON `config`, and timestamps in `saved_view`.
  Configuration is explicitly consumer-owned.
- [Its PostgreSQL adapter](../../crates/saved_views/src/pgsql.rs) implements
  personal CRUD. PATCH shallow-merges JSON. Ownership checks currently live in
  the [DSS REST adapter](../../services/document_storage_service/src/api/saved_views.rs),
  not a domain service. There are no GraphQL saved-view operations.
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

Keep reusable frontend CRUD, configuration decoding, and draft behavior in
`features/saved-views`. Keep Task vocabulary, filter conversion, navigation, and
rendering in `features/tasks-view`. Do not make the generic feature import Tasks
or CRM components.

## Stored filter contract

### Generic resource

Keep the existing JSON `config` column. New consumers use a versioned envelope:

- `kind`: a stable consumer identifier, initially `tasks`.
- `version`: the consumer's definition version, initially `1`.
- `filters`: that consumer's declarative filter definition.

The backend validates generic write bounds and stores the configuration without
interpreting Task fields. It can filter lists by `config.kind`. The consumer owns
a strict, versioned decoder. Existing CRM configurations do not gain mandatory
new fields or undergo a rewrite.

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
    "scope": "assigned-to-viewer",
    "statusOptionIds": ["<in-progress-option-uuid>"],
    "priorityOptionIds": [],
    "assignees": [],
    "creators": [{ "type": "user", "id": "macro|example@example.com" }],
    "tags": [{
      "propertyDefinitionId": "<tag-property-uuid>",
      "optionId": "<tag-option-uuid>"
    }]
  }
}
```

- Scope is `all`, `assigned-to-viewer`, or `created-by-viewer`. It is an actual
  filter, not a saved tab or layout choice.
- Person references are either `{ "type": "viewer" }` or
  `{ "type": "user", "id": "..." }`. The picker distinguishes the relative
  **Me** option from a fixed person. Do not replace every occurrence of the
  creator's ID with a viewer token.
- Within each facet, values are alternatives (OR). Different facets and scope
  are combined with AND, matching existing Tasks behavior. An empty facet adds
  no restriction.
- Persist stable status and priority option IDs, not display labels. Persist
  both tag IDs so inaccessible or deleted tag metadata cannot erase a clause.
- Capture the actual open-status selection when present. Do not depend on
  whatever default statuses a future client chooses.
- Scope remains separate from the assignee/creator facet: My Tasks plus an
  explicit assignee selection means both conditions, not their union.

Materialization resolves viewer references at open/query time and converts the
result into the existing Task facets and scope. The same resolved definition
must feed list, board, Gantt, client predicates, and temporary text-search
requests. Search text is not saved, but search results must satisfy every saved
filter. In particular, search must use stored tag bindings rather than silently
dropping tags absent from the viewer's metadata. If a search backend cannot
express a condition, block that search with an explicit unsupported state;
never run it with fewer conditions. Changing layout remains a local preference
and does not dirty the saved definition.

The decoder must account for every stored condition. Malformed definitions,
unsupported versions, and unsupported conditions show an unavailable-view state
without issuing a broader query. Missing person or tag labels use an unavailable
label while retaining their exact filter IDs. Owners can explicitly remove such
conditions; loading them must not silently remove them. A missing authenticated
viewer blocks relative-filter execution.

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

### Permanent revocation needs membership identity

Simply storing a team ID and checking membership is insufficient: leaving and
rejoining would resurrect the old share. Deleting a share on membership deletion
also has a problem: [team removal](../../crates/teams/src/domain/team_service.rs)
commits that deletion before fallible billing, channel, and role operations,
and can compensate by restoring membership.

Recommended design:

1. Give each `team_user` membership lifetime an internal UUID. Existing rows
   receive one through an additive migration. Genuine joins generate a fresh UUID.
2. Preserve that UUID in the internal removal receipt and restore the same UUID
   during compensation. Do not add it to public team DTOs.
3. Store nullable `shared_team_id` and `shared_owner_membership_id` on a view.
   Sharing records the owner's current membership lifetime.
4. A team share is effective only while the owner's current membership UUID
   matches the stored UUID and the viewer currently belongs to the same team.
5. Unsharing clears both fields. A deleted team makes the view private, not
   deleted. An expired share remains private in API responses and the UI.

This makes absence revoke access immediately, successful compensation restore
prior sharing, and a genuine rejoin leave old shares private. No cascade-delete
of definitions, destructive share cleanup, or restoration of stale grant
snapshots is needed. The owner must deliberately share again.

The Teams-owned port supplies authoritative membership evidence; saved-view
storage owns definition persistence. Do not query or mutate `team_user` directly
from a GraphQL resolver or add saved-view SQL to team handlers. Listing must apply
effective visibility before its public pagination limit, with batched membership
evidence rather than per-row service calls.

**Implementation checkpoint:** audit every membership insertion and compensation
path. Removal rollback currently uses `ON CONFLICT DO NOTHING`; it must distinguish
an idempotent same-lifetime restore from a different, newer membership. Join
rollbacks must likewise delete only their own lifetime: both invite-acceptance
rollback and direct-join rollback currently remove by user/team alone. A
conflicting new lifetime must never be overwritten or deleted. Settle these
concurrency behaviors before implementing sharing.

## Persistence and GraphQL

Add an internal integer revision, starting at one, to `saved_view`. All writes,
including legacy REST writes, advance it. Add indexes supporting owner/kind and
shared-team/kind listing with stable created-time/ID ordering. Existing rows
remain private and retain their configuration.

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
shared team ID, revision, and timestamps. Internal membership tokens never leave
the server. Generate the GraphQL envelope types and SDL; the frontend-owned JSON
schema is not a second handwritten GraphQL DTO.

Updates distinguish omission from clearing. Omitted fields stay unchanged;
private sharing is explicit. A submitted config replaces the whole definition.
Retain legacy REST shallow-merge behavior through an explicit domain update
operation, rather than changing CRM's existing PATCH semantics.

Stale revisions return a terminal conflict and preserve the newer record. Keep
the draft so the user can reload or save a separate copy. Retried creation with
the same owned ID returns the existing resource without overwriting it; retried
deletion of an absent ID is harmless. GraphQL permission, conflict, and validation
errors must not become transport retries that block the mutation queue.

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

The main pane displays the selected view's name and its normal Task controls.
Provide an accessible overflow menu for Rename, Sharing, Copy link, Save a copy,
and Delete. Non-owners get only actions they can perform; backend enforcement
remains authoritative. Delete requires confirmation.

Add **Save as view** to the Task filter control. It captures structured filters
and implicit scope, excluding search. Show a short reminder when search is
active so the saved definition is not mistaken for the visible search results.

### Drafts and explicit saving

- `+` starts a transient New view with All Tasks scope and the normal open-status
  selection, shown as explicit filters. It does not copy the current selection
  or create a database row yet.
- Reuse the Task filter controls to configure it. Saving requests a name and
  optional team sharing. Cancel restores normal navigation without persistence.
- Opening a saved view replaces the prior filter scope rather than intersecting
  with the previously selected built-in tab. Clear unrelated text search.
- Changes show Save changes, Reset, and Save as new for the owner. Other viewers
  can Reset or Save as new, but cannot overwrite the shared definition.
- Only a confirmed write updates the saved baseline. Failures keep the draft and
  its inputs. Leaving the view discards temporary filters, including when a
  background save fails after navigation.
- Task-detail navigation and its return breadcrumb retain the originating saved
  view identity, but do not persist an unsaved filter draft. Scope async results
  to the account, selected view, and revision before installing them.

### Mobile

Tasks currently has navigation pills and a filter drawer, not a mobile sidebar.
Add a Views picker using the shared `MobileDrawer`; include the named list,
active saved-view name, and the section's `+`. Preserve the built-in navigation
and existing mobile list-only behavior.

Expose Save as view inside the filter drawer and management through the saved
view's overflow actions. Use the existing dialog/drawer conventions for naming,
sharing, conflicts, and delete confirmation. No hover-only controls or
desktop-only management actions.

### URLs and unavailable views

Extend the Tasks route/search codec with a stable `savedView` ID, for example
`/app/component/tasks?savedView=<uuid>`. Links identify the stored definition;
they do not serialize filters or bypass sharing. A private link stays private.
Preserve the normal Task-detail route composition and split behavior.

A missing, deleted, unshared, or inaccessible view shows an unavailable state
with a return-to-Tasks action. Do not fall back to All Tasks under the saved
view's name. A list failure retains already loaded rows with a retry action;
a configuration failure never executes a partially decoded query.

## Delivery and review boundaries

Implement in focused slices, with behavior checks alongside each slice:

1. Versioned Task definition codec and generic saved-view domain/storage design;
   additive membership-lifetime and revision migrations, including rollback rules.
2. GraphQL adapter, viewer reads, service wiring, generated contracts, and mutation
   cache policy. Preserve existing REST/CRM behavior.
3. Reusable frontend queries/drafts and the main Tasks desktop/mobile integration.
   Keep project and CRM embedded Task consumers unchanged.
4. Update the Tasks agent guide and affected crate guidance; exercise permissions,
   multiple viewers, revision conflicts, missing filters, and navigation in the
   local app before rollout.

Deploy the additive database and backend GraphQL changes before enabling the
frontend consumer. Do not add a REST fallback when the new schema is unavailable.
Reuse existing tracing across writes and filter loading without logging names,
configuration contents, or person identifiers.

### Points for design review

- Consumer-owned, versioned filter definitions are recommended over storing a
  compiled Soup AST or the entire Task view state.
- Permanent owner-departure revocation adds a membership-lifetime UUID to Teams;
  this is the main backend scope expansion and needs the rollback audit above.
- Cross-client changes revalidate rather than using a new realtime subscription.
- No existing CRM views are migrated or reinterpreted in this feature.
