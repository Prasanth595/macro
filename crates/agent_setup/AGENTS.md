# agent_setup

## What it is

Agent-led setup over MCP: the Setup tools a person's own AI agent (Claude,
ChatGPT, Codex) uses to set up their Macro workspace. They report what's set
up, hand out connect links, show what Macro found, agree one plan, import it,
report back, and show what the person's inbox and calendar say about their
work. Served only while `ENABLE_AGENT_SETUP` is on in
`agent_harness_service`'s public MCP.

## How it works

`SetupGetState` → `SetupConnect` (one `/app/connect/:app` link per tool; links go
out for importable apps and email, the rest are optional; called again once
the person used the links, it starts Macro looking through what's connected) →
`SetupDiscover` → `SetupProposePlan` (one approval) → `SetupImport` →
`SetupGetStatus` → `SetupFirstLook` (when an inbox is connected). Every result
carries one `next_step` the agent follows. Each step wraps an existing
service; the import service still does all copying.

Looking through an app:
- Notion: Notion's workspace planner (`prepare_notion_import`) reads the whole
  workspace and decides per object (copy, tasks, skip, by hand). Candidates are
  the plan's top items; each stands for everything under it. Approval writes
  the plan through `start_notion_write`, under a review id setup makes.
- Linear and Slack: `start_discovery` lists open Linear issues (last 90 days;
  the whole workspace's for a Linear admin, otherwise the person's own) or the
  Slack channels; approved rows go to `run_import`.

The first look (`SetupFirstLook`) reads counts from the email service
(`EmailCorrespondence`: who the person wrote to, threads waiting on a reply)
and meetings from the calendar service, and `domain/first_look.rs` turns them
into teammates (same work domain), outside companies (by domain), waiting
threads, this week's outside meetings and routine ideas, by rules alone. Its
`next_step` has the agent read a few listed threads before describing a
relationship, then offer CRM, a meeting prep note, each routine and invites
one at a time, using Macro's existing tools.

## Start here

- `src/domain/service.rs`: the steps; `service/next_step.rs` the
  `next_step` after state and discovery; `service/report.rs` the final report;
  `service/first_look.rs` the first look.
- `src/domain/first_look.rs`: the first look's rules and limits.
- `src/domain/catalog.rs`: how each tool is handled (import, import later,
  keep connected, inbox for Gmail and Outlook, kept and connected inside Macro
  for Calendar and GitHub); importability comes from `ImportSource`.
- `src/domain/view.rs`: one source's ledger rows as setup talks about them,
  including a Notion plan's tree.
- `src/domain/plan.rs`: resolving selections and the plan text the person
  approves.
- `src/inbound/toolset.rs`: tool schemas and annotations.
- `src/outbound/`: the import, Pipedream connection, email, and mail and
  calendar activity adapters.

## Scope

- Owns: sequencing setup and what the agent is told at each step.
- Not here: what a listing or Notion's planner finds, or how items are
  copied → `crates/import`; connections → `crates/pipedream_mcp`; the
  person's account, the sign-in hook, setup hint and composition →
  `services/agent_harness_service` (`src/public_mcp/`).

## Boundaries

- Depends on: `import` (models and service), `import_notion` (the plan's
  scope), `pipedream_mcp`, `mcp_select`, `email` (ports), `calendar_events`,
  `email_utils` and `generic_email_domains`, through the ports in
  `src/domain/ports.rs`.
- Used by: `ai_tools` (`mcp_tools_with_agent_setup`, `ToolAgentSetupParts`),
  `services/agent_harness_service`.

## Checks

- `cargo test -p agent_setup`

## Gotchas

- The import port can't discard: imported content can carry prompt
  injections, so no Setup tool may decline items permanently or import
  anything the person didn't approve. Notion's write discards what the person
  left out and what the plan leaves in Notion, as its review card does; the
  next plan stages those again. `SetupImport` ties the Notion plan to its
  review first, then excludes every tied row the person didn't approve, so a
  plan that changed after the approval can't bring in anything unseen.
- Notion comes in only through its workspace plan; a page staged on its own
  (by URL from chat) is not a setup candidate. Declining any item, a sub-page
  too, leaves out everything under it, through items the plan leaves in
  Notion.
- Only `SetupConnect` and `SetupImport` write. Keep the rest read-only so
  clients that confirm writes ask the person at most twice. What the agent
  offers after the first look goes through Macro's own tools, each on a yes.
- Results never carry document content; candidates are titles and short refs.
  The first look carries addresses, names, subjects and counts, never message
  bodies. Personal addresses (gmail.com and the like) and automated senders
  are left out, and so is anyone the person never wrote to; threads and
  meetings name only people it lists. It reads only the person's own inboxes,
  not delegated ones.
- Someone on a team gets a Notion plan where Macro chooses who sees each item;
  the plan text shows how many go to the team, and `notion_sharing` ("team" or
  "personal") overrides it at write time. It is part of the plan id.
- Setup counts as done (`SetupAccounts::finish`) when `SetupGetStatus` finds
  nothing left to connect, look through or approve for the apps named, or when
  an approved plan brings nothing in. So people who import nothing aren't led
  back into setup. `SetupGetStatus` is annotated read-only although it records
  this; it changes nothing the person sees.
- Inboxes match by provider: a Gmail inbox doesn't count as Outlook.
- A plan can't be proposed while a selected app is still being looked through,
  with declined refs that match nothing, or with Slack before the person has a
  team (Slack channels become team channels).
