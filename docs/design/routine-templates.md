# Routine templates

**Status:** proposed, not started. Mocks: rows "The plan" (P1–P4) and
"Templates" (T2–T5) of the [Routine Sharing canvas][canvas]. The canvas also
holds rejected explorations (store, versioning, marketplace); ignore those.

A routine runs as its owner: their inbox, calendar, channels, documents, and
agents. That makes sharing the routine itself unsafe and mostly useless to the
recipient. Instead, sharing a routine creates a **template**: the routine's
instructions and triggers with every person-specific value pulled out into
named **variables**, including the agent that runs it. A recipient who opens the
template clicks **Activate for me**. Macro uses AI to fill in the variables from
the recipient's own workspace, shows the result in a review modal, and on
confirmation creates an ordinary routine owned by, and running as, the
recipient.

This document is the contract for building that. In scope: templates,
variables, AI extraction on share, AI auto-fill on activate. Out of scope:
a template store or gallery, template versioning or update propagation,
editing someone else's routine, running a routine as anyone but its owner,
and selling or paying for routines.

## Concepts

| Term | Meaning |
| --- | --- |
| Routine | A `scheduled_action` row. Owned by one user and always runs as that user. Unchanged by this design. |
| Template | A shareable snapshot of a routine with variables in place of person-specific values. It never runs. |
| Variable | A named slot in a template: label, kind, description, and either *variable* (each person fills it in) or *fixed* (everyone gets the creator's value). |
| Binding | A value for one variable chosen at activation. |
| Activation | Creating a new routine from a template plus a complete set of bindings. |

Rules that follow from these:

- A template is a snapshot. Editing the source routine does not change the
  template. The creator can choose **Update template** from the routine, which
  overwrites the snapshot in place. Activated routines are never touched by
  either action. There is no version history.
- An activated routine is a normal routine. The activator owns it, can edit
  it, and it runs as them. It records which template it came from and the
  bindings it was created with, for display and for "fill in again".
- Sharing grants **view** access to the template only. Nobody gets access to
  the creator's routine, its runs, or its results.
- The creator's values for *variable* slots are never stored in the template
  and never sent to anyone else's auto-fill.

## What exists today

Routines are owner-only end to end. Facts a successor needs:

- Storage and API live in `services/scheduled_action`. Tables:
  `scheduled_action` (`owner`, `name`, `task` JSONB, `trigger_config` JSONB,
  `timezone`, `enabled`, …) and `action_execution_record`. There is no
  `created_by`; `owner` is the only identity
  ([models.rs](../../services/scheduled_action/src/domain/models.rs) `ScheduledAction`).
- `task` is `AgentTask { model, agent: { bot_id }, prompt, user_prompt }`. The
  routine's instructions are markdown in `user_prompt`; `prompt` is empty.
- Triggers are `ActionTrigger = Cron | Events | Multiple`
  ([event_trigger.rs](../../services/scheduled_action/src/domain/event_trigger.rs)).
  An `EventFilter` has `events`, optional `ids` (specific channels, documents,
  tasks, threads, calls), and an optional yes/no `condition`. Filters without
  `ids` are already relative to the owner ("your inbox", "you are mentioned").
- Runs open an agent session as `action.owner_user()`
  ([target_runner.rs](../../services/scheduled_action/src/domain/target_runner.rs)).
  `persona_for_owner` and `TargetValidation::validate_task` reject an agent the
  owner may not use, and `EventAccessCapability` requires the owner's own access
  to each event entity. These checks are what keep an activated routine safe;
  activation must go through them, not around them.
- `entity_access` already has `entity_type='scheduled_action'` owner grants,
  but the service re-filters every read to `owner == caller`
  (`load_granted`, `list_accessible_actions` in
  [service.rs](../../services/scheduled_action/src/domain/service.rs)). Leave
  that as is.
- Mentions in `user_prompt` use the shared serialized form, for example
  `<m-user-mention>{…}</m-user-mention>` and `<m-document-mention>{…}</m-document-mention>`
  (channels are document mentions with `blockName:"channel"`). Parsers exist in
  [mentions.ts](../../packages/lexical-core/transformers/mentions.ts) and
  [mention_utils](../../crates/mention_utils/src/serialize.rs).
- "Duplicate" is frontend-only: it POSTs the routine body back to
  `/scheduled-actions` (`scheduleToDuplicateBody` in
  `apps/web/src/features/routines/queries/routine-draft.ts`).
- Routines are not a shareable entity type in the web share modal
  (`isShareableEntityType` in
  `apps/web/src/features/sharing/global-share-modal/shareable-entity.ts`).
- The agent target is `{kind:'model', model} | {kind:'agent', agentId, modelOverride?}`
  on the web and `ResolvedTaskTarget` on the server. Available agents come
  from `GET /agents` (`crates/bots`) and the web roster
  (`apps/web/src/features/agents-view/core/roster.ts`).
- One-shot structured AI calls use
  `agent::structured_output::dynamic_structured_completion`. The closest
  precedent for "run tools as a user, then distill to a schema" is
  [agent_generator.rs](../../crates/ai_projections/src/outbound/agent_generator.rs).
  Read-only workspace tools already exist: `ContentSearch`, `NameSearch`,
  `ListEntities`, `ListInboxes`, `ReadChannelMessages`, `ListTeamMembers`,
  `ListAgents`.

## Data model

New table `routine_template` (MacroDB migration):

| Column | Notes |
| --- | --- |
| `id` | UUID. |
| `owner` | Creator's user id. Only the owner may update or delete. |
| `source_action_id` | Nullable `scheduled_action.id`, `ON DELETE SET NULL`. Deleting the routine keeps the template. |
| `name`, `description` | Shown on the template page and channel card. |
| `task` | JSONB: the agent task with the target and prompt templated (below). |
| `trigger_config` | JSONB: the routine trigger with variable references (below). |
| `variables` | JSONB array of `TemplateVariable`. |
| `created_at`, `updated_at` | |

Add to `scheduled_action`: nullable `source_template_id` (no FK; templates may
be deleted) and `template_bindings` JSONB (the bindings used at activation).

Access uses `entity_access` with a new `entity_type='routine_template'`: an
owner grant on create, and view grants through the normal share paths (users
and channels). Add the type wherever entity types are enumerated (Rust enums,
SQL checks, `ItemType` on the web).

### Variables

```rust
struct TemplateVariable {
    key: VariableKey,           // stable slug, unique in the template: "urgent_channel"
    label: String,              // "Urgent channel"
    description: String,        // one line, written for the recipient
    kind: VariableKind,
    mode: VariableMode,         // Variable | Fixed(BoundValue)
}

enum VariableKind {
    Agent { needs: Vec<Capability> },   // the routine target; always present
    Schedule,                           // cron + timezone
    Text,                               // free text: a company, a domain, a label
    User,
    Channel,
    Document,
    EventEntity { entity_type: EventEntityType }, // ids in an event filter
}

enum BoundValue {
    Agent(ResolvedTaskTarget),
    Schedule { cron: String, timezone: String },
    Text(String),
    Entity { id: Uuid },                // user, channel, document, event entity
}
```

`Fixed` values are the creator's choice for everyone, for example a team
channel everyone is in. A fixed entity the activator cannot access is treated
as unfilled at activation and must be replaced; it is never silently dropped.

### Placeholders

- **Instructions:** a new serialized node
  `<m-template-variable>{"key":"urgent_channel"}</m-template-variable>`, added
  to both mention serializers so the Lexical editor renders it as a chip and
  Rust can find and replace it. Rendering replaces each node with the bound
  value in its normal form (a user, document, or channel mention for entities;
  plain text for `Text`). Every variable is required; there are no optional
  slots.
- **Trigger:** wherever a value would appear, the template stores
  `{"$var":"<key>"}`. That covers a cron entry's `schedule`/`timezone` (one
  `Schedule` variable) and individual entries in an event filter's `ids`.
  Event filters without `ids` stay as they are; they are already relative to
  whoever owns the routine.
- **Target:** the template's `task` stores `{"$var":"agent"}` in place of
  `model`/`agent`. The agent is always a variable, never fixed, because the
  activator may not be allowed to use the creator's agent.

Rendering a template with bindings must produce exactly the
`ActionConfiguration` the existing create endpoint accepts. Keep that
function pure and unit-test it; it is the core of the feature.

## Flows

### 1. Share creates a template (mock P1)

1. The owner opens Share on their routine. The web calls
   `POST /routine-templates/extract` with the `source_action_id`. Nothing is
   saved.
2. The server builds candidates deterministically: the target agent, each
   cron trigger, each event filter id, and each user, channel, or document
   mention in `user_prompt`.
3. A structured-completion pass over the instructions then:
   names and describes each candidate for a recipient, finds person-specific
   plain text (a customer name, an email domain) and proposes `Text`
   variables with the spans to replace, and suggests `Variable` or `Fixed`
   for each one (fixed when the value is broadly shared, such as a
   team-wide channel). It returns a schema-validated draft template. If the
   model call fails, return the deterministic draft; the share still works.
4. The dialog shows the template as it will read, with variable chips, beside
   the variable list. The owner can switch each between Variable and Fixed,
   rename it, and edit its description. The footer states that their values
   stay private.
5. **Share template** calls `POST /routine-templates` with the edited draft,
   then shares it through the existing share and forward-to-channel paths as
   an entity attachment. Re-sharing a routine that already has a template
   offers **Update template** (overwrite) or **Share existing**.

### 2. Viewing a template (mocks P2, T2, T3)

- A channel message carries the template as an attachment card: label
  "Routine template", name, description, triggers in plain words, and
  **Activate for me** / **View template**.
- The template page is visually distinct from a routine (violet "Template"
  label, dashed outline icon). Its header pairs "Routine template, by
  <creator>" with a primary **Activate for me** block. The body shows the
  triggers and instructions with variable chips and a sidebar listing each
  variable with its kind and description. Fixed values render as normal
  references.
- If the viewer already activated this template, show "Active for you" with a
  link to their routine instead of hiding the activate action; activating
  twice is allowed (for example, two customers).

### 3. Activate: AI fills it in, you review (mock P3)

1. **Activate for me** opens the review modal and calls
   `POST /routine-templates/{id}/fill`, which runs **as the activator** with
   only their access.
2. The server runs a bounded, read-only agent loop (the `agent_generator`
   pattern) with `ContentSearch`, `NameSearch`, `ListEntities`,
   `ListInboxes`, `ReadChannelMessages`, `ListTeamMembers`, and `ListAgents`,
   given the template text, the variable list, and any user instruction. It
   then distills to a schema of
   `{ key, value, reason, confidence: high|check }` per variable.
3. The server **validates every value before returning it**:
   the entity exists and the activator can access it (`entity_access`); a
   channel is one they can post to; the agent passes the same check as
   `TargetValidation::validate_task`; a schedule parses. A value that fails
   becomes unfilled with a reason. If the activator has no agent that meets
   `needs`, fill the agent with Macro and say why.
4. The modal shows each variable filling in (skeleton while pending), the
   live preview of the instructions with filled values, and per variable the
   value, the one-line reason, and **Change**. Values marked `check` are
   amber. **Change** opens the normal picker for that kind (agent picker,
   schedule editor, entity selector, text input). An **Ask for changes**
   input ("do this for Initech instead") re-runs fill with the instruction and
   the current values, so related variables change together.
5. **Activate** is disabled until every variable has a valid value. It calls
   `POST /routine-templates/{id}/activate` with the bindings. The server
   re-validates, renders the template, and creates the routine through the
   existing create path, so target validation, event access, and owner
   grants all apply. The new routine is enabled, named from the template
   (the AI may suggest a name using bindings, e.g. "Weekly Globex digest"),
   and stores `source_template_id` and `template_bindings`.
6. Nothing is persisted before **Activate**. Closing the modal discards the
   fill.

Fill should stream per-variable results (SSE or the existing streaming
transport) so the modal can show progress. A single response is acceptable
for the first cut; the UI must still show a loading state per row.

### 4. The activated routine (mock P4)

It is the normal routine page with two additions: a header block "From
<creator>'s template" linking to the template, and a **Your variables** card
listing the bindings, each with **Change** and a **Fill in again** action.
Changing a binding re-renders only that value into the routine, so it only
works while the routine's instructions still match what the template
produced; once the owner hand-edits the instructions, hide the card and keep
the provenance link. The routine is fully editable like any other.

## API

All on `services/scheduled_action` (or a sibling module in the same service).

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /routine-templates/extract` | Owner of the source routine | Draft a template; no write. |
| `POST /routine-templates` | Owner of the source routine | Create the template and owner grant. |
| `PUT /routine-templates/{id}` | Template owner | Update template from the routine, or edit variables. |
| `DELETE /routine-templates/{id}` | Template owner | Delete; activated routines are unaffected. |
| `GET /routine-templates/{id}` | View | Template for display. Never includes the creator's values for variable slots. |
| `POST /routine-templates/{id}/fill` | View | AI proposal for the caller; no write. |
| `POST /routine-templates/{id}/activate` | View | Validate bindings, create the caller's routine. |

Add the SDK wrappers (`add-sdk-endpoint` skill) and register the template
entity with the batch preview used by channel attachment cards. The existing
`MessageReferenceKind::Automation` skips authorization; templates must not.
Give them their own reference kind that checks view access.

## Privacy and safety

- The template stores names, kinds, descriptions, fixed values, and the
  instructions with placeholders. It never stores the creator's values for
  variable slots. `GET` must not return them, and the fill prompt must not
  include them.
- Extraction can miss specifics left in plain text. The share dialog's
  preview is the creator's check; keep it prominent.
- Fill runs with the activator's permissions only, through read-only tools.
  Its output is untrusted: constrain it to the schema and validate every value
  server-side before showing it, and again on activate.
- Workspace content read during fill may contain prompt injection. The tools
  are read-only and the output is only a set of validated bindings, which
  bounds the damage to "a wrong suggestion the user reviews".
- Fill reads the activator's inbox, channels, and documents. The modal must
  say so before or while it runs ("Reading your inbox, channels, docs and
  agents to fill this in. Nothing is saved yet.").
- Metering: fill is a model call on the activator's account; use the same
  usage context and admission as other AI operations.

## Observability

Per `.agents/rules/observability.md`, one trace per flow:

- `routine_template.extract`: child spans for the deterministic pass and the
  model call. Fields: `source_action_id`, `variable_count`, outcome.
- `routine_template.fill`: child spans for the tool loop, the distill call,
  and validation. Fields: `template_id`, `user_id`, `variable_count`,
  `filled_count`, `check_count`, `invalid_count`, tool-call count.
- `routine_template.activate`: `template_id`, `user_id`, new `action_id`.

Never record prompts, instructions, variable values, or reasons.

## Frontend

All under `apps/web/src/features/routines` following the layered feature
architecture (`docs/architecture/frontend-features.md`), plus:

- **Share entry point** on the routine detail page (owner only), opening the
  share-as-template dialog (P1). Reuse the share modal's forward-to-channel
  piece with an entity attachment rather than building a new sender.
- **Variable chip** node in the Lexical markdown shell, read-only, used by the
  template page, the share preview, and the review modal.
- **Template page** route and **channel attachment card** (P2, T2).
- **Activate modal** (P3) with per-kind pickers reused from the routine editor:
  `RoutineExecutionPickerView` for agents, the schedule settings component,
  `PropertyEntitySelector` for entities.
- **Provenance** block and **Your variables** card on the routine page (P4).
- Add `'routine_template'` to `ItemType` and the share item types.
- Mobile: the share dialog and activate modal become full-height sheets, like
  the existing mobile share sheet; the two-column layouts stack with the
  preview below the list. Confirm with design before building.

## Rollout

Gate everything behind a web flag `enable-routine-templates` (`defineFlag`,
see the `feature-flags` skill) and a server config switch on
`scheduled_action` (`ROUTINE_TEMPLATES_ENABLED`, added per
`.agents/rules/config-and-service-urls.md`: Doppler `dev`, `prd`,
`local/lcl_personal`, and a `BootStubEnv` placeholder).

Suggested order, each shippable behind the gate:

1. Migration, template storage, entity type and grants, CRUD, `GET`, and
   `activate` with explicit bindings. Pure render function with unit tests
   for every variable kind and trigger shape.
2. Web: template page, variable chip, activate modal with manual pickers only
   (no AI), provenance on the routine page.
3. Share flow with deterministic extraction, channel attachment card, preview
   batch support.
4. AI extraction pass on share.
5. AI fill with validation, then streaming and **Ask for changes**.
6. Update the agent guide (`docs/agent-guide/navigation.md` currently says
   routine creation has no templates) and the `AGENTS.md` files of the
   crates and services touched.

## Open questions

- Should the creator be able to see who activated their template (a count, or
  names)? The mocks show a count. Names reveal who runs what; default to a
  count.
- Can a viewer re-share a template they were given? Documents allow
  forwarding with the sharer's access level; matching that is simplest.
- Event conditions (the yes/no `condition` text) may contain specifics too.
  Extraction should treat them like instructions; confirm the trigger editor
  can render variable chips there.
- Should `Text` variables be checked against the activator's data (e.g. that
  `@globex.com` appears in their inbox), or only proposed by fill?

## Implementation references

- [scheduled_action service](../../services/scheduled_action/AGENTS.md)
- [routines AI tools](../../crates/routines/AGENTS.md)
- [agent sessions and persona checks](../../crates/agent_session/AGENTS.md)
- [entity access service](../../crates/entity_access/src/domain/service.rs)
- [structured output](../../crates/agent/src/structured_output.rs)
- [AI projections agent generator](../../crates/ai_projections/src/outbound/agent_generator.rs)
- [routine draft wire mapping](../../apps/web/src/features/routines/queries/routine-draft.ts)
- [routine triggers (web)](../../apps/web/src/features/routines/core/routine-triggers.ts)
- [share modal](../../apps/web/src/lib/core/component/TopBar/ShareButton.tsx)
- [forward to channel](../../apps/web/src/lib/core/component/ForwardToChannel.tsx)

[canvas]: https://claude.ai/artifact/2gYmPfUYA6B5XtRVrUwtRK
