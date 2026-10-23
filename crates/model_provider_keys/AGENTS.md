# model_provider_keys

## What it is

Part of AI chat: people's and teams' own Anthropic and OpenAI API keys. A
person registers their own; team admins register the team's. In-memory AI chat
(`agent_inmem`) can run turns on them instead of Macro's allowance. See the
crate doc in `src/lib.rs`.

## Start here

- `src/domain/service.rs`: the policy — a person manages their own keys
  (`*_personal`); team admins register/remove (`EntityAccessReceipt<AdminTeamRole>`),
  members list (`<MemberTeamRole>`); `ModelKeys` for the chat runtime.
- `src/domain/models.rs`: `ModelProvider`, `ProviderApiKey` (prefix rules),
  `KeyOwner` (user or team), `KeySource` (personal or team).
- `src/outbound/pg.rs`: rows in `cursor_configs` with a `user_id` or a
  `team_id` and a provider other than `cursor`.
- `src/outbound/plans.rs`: `KeyPlans` over ai_billing's entitlements; keys
  need Premium, Max, or an enterprise team.

## Scope

- Owns: the Anthropic/OpenAI rows of `cursor_configs`, personal and team.
- Not here: users' Cursor rows → `crates/cursor_api_key`; routing a turn on a
  key → `crates/agent` (`AgentLoop::with_provider_key`); deciding when a turn
  uses one → `crates/agent_inmem` (`domain/funding.rs`).

## Boundaries

- Depends on: `cursor_api_key` (the `KmsCiphertexts` seam and its CMK),
  `entity_access` (team receipts), `ai_billing` (plans).
- Used by: `authentication_service` (settings routes),
  `agent_harness_service` (decrypt-only, for turns).

## Checks

- `cargo test -p model_provider_keys` (`SQLX_OFFLINE` unset).

## Gotchas

- A member's team key lookup joins `team_user` on every turn: never cache a
  decrypted key or a membership answer across turns.
- Prefixes are enforced twice: `ProviderApiKey::parse` and the
  `cursor_configs_key_prefix` check. Change both together.
- The KMS context names the owner. Team keys use the context they were first
  encrypted under (`the_team_context_is_unchanged` pins it); changing it makes
  stored keys undecryptable.
- Keys are a paid-plan feature, checked on save and on every turn. A
  downgrade keeps the row: it stays listed and removable, but `ModelKeys`
  answers as if it did not exist.
- Deleting a row does not revoke the key at the provider.

## Related

- Rules: `.agents/rules/rust/security.md`, `.agents/rules/rust/db.md`
