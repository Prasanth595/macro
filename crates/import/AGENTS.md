# import

## What it is

Belongs to AI chat and Settings: the import pipeline tracking external items
(Linear issues, Notion pages, Slack channels) as they're discovered,
accepted, and copied into Macro entities. Host-agnostic — chat tools,
Settings → Slack discovery, and the Slack archive import drive the same
primitives, distinguished only by the `initiator` recorded on each row.

Not to be confused with `crates/foreign_entity`: foreign entities stay live in
the external system; an `ImportEntity` here is a ledger row for an item being
copied in, moving `staged` → `importing` → `imported` (or `discarded`). Rows
carry their source `kind`, an optional `parent_id` (the row they were imported
under), and an optional `review_id`; a team keeps one `importing`/`imported`
row per Notion or Linear object (`import_entity_team_object_key`).

Notion workspace imports go through a reviewed plan: `ImportFromNotion`
(`plan`) reads the workspace over Notion's REST API (`import_notion`, through
the user's Pipedream grant), asks the decision model what to do with each page
and data source (copy, tasks, skip, or by hand), and stages the plan as ledger
rows. The agent presents it with `PresentReview` (kind `import`); the harness
ties the rows to the review (`review_id`) and, on approval, starts the write:
folders mirroring the page tree, documents, databases with rows, row bodies and
relations, and task lists as Macro tasks. The Notion run row tracks it
(`running` → `ready` → `importing` → `completed`/`failed`/`dismissed`).

Every plan carries the user's `sharing` (`team`, `personal`, or `ai`, where
the decision model also answers `shared` per object; the tool requires the
agent to ask first), stored on the run so an adopted plan keeps it, and each
plan item records `shared`, `sharedReason` and `shareable`
(`notion_workspace/sharing.rs`). The owner can flip items on the review card;
the draft's `shared`/`personal` lists are written onto the rows before the
write starts. Databases cannot be team-shared, so they and users without a
team stay personal. The write shares documents and task-list folders it makes
(`WorkspaceWriter::share_with_team`) and a page's folder only when everything
written inside it is shared, since sharing a folder shares its contents.

## Start here

- `src/domain/models.rs`: `ImportEntity` and its state machine — read the
  module doc comment for the staged/importing/imported/discarded distinction.
- `src/domain/service.rs` + `src/domain/service/admission.rs`: Slack
  discovery, staging, and acceptance logic.
- `src/outbound/mcp_slack_source.rs`: Slack discovery via MCP tool calls, with
  `fixtures/*.json` backing its tests.
- `src/domain/service/notion_workspace.rs` (+ `plan`, `triage`, `sharing`,
  `object`, `write`, `values`, `report`): the Notion workspace import —
  planning, the decision model, who sees what, writing one object (claim,
  link or write), cancel and the report.
- `src/inbound/toolset.rs`: the AI-chat-facing import tools
  (`toolset/import_from_notion.rs` is the workspace import tool).
- `src/inbound/axum_router.rs`: the `/import/*` routes (state, accept/decline,
  Slack discovery, the Notion import report and cancel).

## Scope

- Owns: the import ledger, Slack discovery, admission logic, and the AI-chat
  and HTTP entry points into it.
- Not here: live references to external items that never get copied in →
  `crates/foreign_entity`.

## Boundaries

- Depends on: `ai_toolset`, `ai_usage`, `ai_billing`, `connection_gateway_client`,
  `mcp_select`, `properties`, `import_notion` (Notion REST), `models_databases`
  (database ops the workspace import writes).
- Used by: `ai_tools`, `slack_integration`, `services/document_cognition_service`,
  `services/agent_harness_service` (import reviews).

## Recipes

- Add an import source: `src/outbound/<source>.rs` (implement the source port)
  → `src/source_binding.rs` → `src/domain/service.rs`.
- Add a toolset action: `src/inbound/toolset.rs` → `src/domain/service.rs`.
- Add a route: `src/inbound/axum_router.rs` → `src/domain/service.rs`.

## Checks

- `cargo test -p import` (`SQLX_OFFLINE` unset).

## Gotchas

- Workspace imports write through the host's `WorkspaceWriter` (the
  `ai_tools` entity creator), which also implements `EntityCreator`; the
  import service's `N` type parameter is the Notion connection factory, and
  hosts that never call `.with_notion_connections` report Notion as not
  connected.
- Notion page bodies are never parsed here: they go to lexical-service
  (`POST /snapshot/notion`) as Notion markdown with a `NotionLinks` map. The
  workspace write knows every planned page's document id up front
  (`write::notion_links`, derived from the ledger row) so pages mention each
  other; only the import guards
  (`check_notion_markdown`: tool-result wrappers, database-only pages) stay in
  Rust.
- Planning and writing run detached on the host's `TaskTracker`
  (`with_job_shutdown`) and survive their process (`notion_workspace/run.rs`):
  the running process holds a lease on the run row (`lease_owner`,
  `lease_expires_at`, renewed by the heartbeat, recording the job: `scope` or
  `review_id`). A cancel from any process flips the run to `dismissed`; on
  shutdown the job stops at its next checkpoint and releases the lease. A run
  whose lease lapsed is adopted (`FOR UPDATE SKIP LOCKED`) by the next report
  read for that user or by document-cognition-service's sweeper: planning
  restarts, writing continues with the rows still `importing`. After five
  adoptions the run fails. Stale-run and stale-row reapers skip Notion
  workspace imports for this reason.
- A resumed write never creates anything twice: documents, row bodies and
  tasks get UUIDv5 ids from their ledger row (`WorkspaceWriter` treats an id
  in use as already written), database columns and options UUIDv5 ids from
  their database, and folders, databases, inserted rows, the Page column and
  relation columns are recorded in `import_entity_written` as they are made.
  Every import reuses the user's "Notion" folder (`import_run.root_folder_id`)
  while it exists. Left open: a crash between creating a folder, a database
  or a row batch and recording it duplicates that one object or batch, and a
  crash between applying a schema op and recording it fails that database on
  resume (Macro refuses the column id).
- `team_id` on a Notion row means "the team's copy": only shared objects take
  it, at `claim_importing` (staged → importing) before anything is written, so
  `import_entity_team_object_key` makes a second teammate's claim fail. A
  personal copy never takes it, so teammates never see or link to it and
  import their own copy. Planning marks objects a teammate already imported
  and shared as `alreadyImported` (no decision-model call, not counted as
  copies); the write links them. At write time `claim_team_object` decides per
  shared object: hold the claim and write, link to a finished copy, take over a
  claim whose holder's run has no live lease, or wait. A waiting row is
  checked again after the rest is written, then parks with `waiting_on` the
  holder's row: `mark_imported` links waiters in a second statement (the
  waiter holds the holder's row `FOR SHARE`, so neither misses the other), and
  a holder going back to staged releases its waiters to staged. Waiting rows
  outlive their own run; `settle_importing` leaves them while the holder is
  still being written. Left open: a takeover racing the original holder's own
  resume can leave both copies.
- When a workspace write stops (completed, failed or cancelled, including a
  resumed write and a stalled one given up on), the service
  calls the host's `ReviewFollowUp` with the plan's review
  (`notion_workspace/follow_up.rs`). Hosts wire it to the harness's internal
  `POST /internal/agent-reviews/{id}/settled` (`ai_tools::build_review_follow_up`),
  which settles the review once and continues the session on
  `import_finished_context` as private context.
- While planning, the inventory's counts go over a `watch` channel to the run
  row (`scanned_pages`/`scanned_data_sources`, at most every 2s and once at the
  end, `notion_workspace/scan.rs`); `list_runs` and the report show them only
  while the run is `running`.

## Related

- Rules: `.agents/rules/rust/architecture.md`
- Skill: `cloud-storage-hexagonal-architecture`
