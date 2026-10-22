# routines

## What it is

Part of the agent sessions feature. Validated routine (scheduled-action)
commands and AI tools for agents to schedule themselves or another
persona/model to run later.

## Start here

- `src/domain.rs`: `RoutineTarget` (model vs. agent persona) and
  `RoutineSchedule` (`Once` / `Cron`) — the validated command shapes.
- `src/inbound.rs`: the AI toolset exposed to MCP and embedded agents.
- `src/outbound.rs`: the HTTP client to the owning scheduled-action service.

## Scope

- Owns: routine command validation and the agent-facing tools to create/manage
  them.
- Not here: the cron engine and durable schedule storage, owned by the
  scheduled-action service this crate's `outbound` calls into.

## Boundaries

- Depends on: `ai_toolset`, `macro_authorization`, `macro_user_id`.
- Used by: `ai_tools`.

## Recipes

- Add a routine tool: `src/domain.rs` (command/schema) → `src/outbound.rs`
  (HTTP call) → `src/inbound.rs` (tool registration). Read the user through
  `RoutineToolContext::user`, and add the tool's name to
  `PROMPTER_NATIVE_TOOLS` in `agent_inmem`'s `rig_engine.rs`.

## Gotchas

- The tools act as `RoutineToolContext::prompter` when the host sets one,
  otherwise as the request's user. The in-process agent runtime sets it to
  the turn's prompter, so a routine asked for in a session somebody else owns
  belongs to the asker, who is also whom it runs as.

## Checks

- `cargo test -p routines` (`SQLX_OFFLINE` unset).

## Related

- Skill: `create-ai-tool` · Rules: `.agents/rules/rust/architecture.md`
