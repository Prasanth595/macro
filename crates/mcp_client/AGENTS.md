# mcp_client

MCP (Model Context Protocol) client library: connects to user-configured MCP
servers (including OAuth-protected ones) and executes their tools for agents.

## Start here

- `src/domain/service/`: connection/tool-execution orchestration
  (`toolset.rs`, `server_access.rs`, `persisting_credential_store.rs`).
- `src/domain/ports.rs`: `McpServerStore`, `OAuthStateStore`, and the OAuth
  port the outbound adapters implement.
- `src/domain/provider_registry.rs` (feature `providers`): pre-registered
  OAuth credentials for known MCP providers, keyed off `macro_env_var`.
- `src/inbound/axum_router.rs`: HTTP routes for server management and the
  OAuth callback.
- `src/outbound/`: `oauth.rs` (RMCP-backed OAuth), `pg_server_repo.rs`
  (Postgres server store), `redis_state_store.rs` (OAuth state).

## Scope

- Owns: storing a user's/team's configured MCP servers, OAuth connect/refresh
  flows for them, and invoking their tools through `rmcp`.
- Not here: the agent's tool-calling loop itself (`agent`, `ai_toolset`) —
  this crate is a tool *provider*, called by that loop.

## Boundaries

- Depends on: `agent`, `ai_toolset`, `macro_authorization` (feature `axum`),
  `macro_user_id`, `rmcp`.
- Used by: `agent_egress`, `agent_harness`, `ai_tools`, `mcp_select`,
  `onboarding`.

## Checks

- `cargo test -p mcp_client` (`SQLX_OFFLINE` unset).

## Gotchas

- MCP tool names reaching this crate from a provider can be mangled;
  `mcp_service` sanitizes them for provider matching — new
  provider integrations should go through the existing registry pattern, not
  a second ad hoc name-matching path.
- OAuth state lives in Redis (`redis_state_store.rs`) separately from the
  server config in Postgres (`pg_server_repo.rs`) — a server record surviving
  doesn't mean its OAuth state did.

## Related

- Rules: `.agents/rules/rust/security.md`, `.agents/rules/rust/architecture.md`
