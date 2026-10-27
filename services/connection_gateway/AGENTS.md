# connection_gateway

## What it is

Shared infrastructure: manages per-entity WebSocket connections so other
services can push messages to a specific connected entity without holding
the socket themselves. It also embeds document sync routing for each socket.

## Start here

- `src/api/connection.rs`: WebSocket upgrade endpoint and connection lifecycle.
- `src/service/sync.rs`: per-socket sync router, bounded outbound delivery,
  cancellation and task joining. Routing core lives in `crates/sync_router`.
- `src/api/message.rs`: HTTP endpoint other services call to send a message to
  a connected entity.
- `src/service/connection.rs` + `src/service/dynamodb.rs`: connection registry,
  backed by DynamoDB (tracks which entity is on which instance).
- `src/service/sender.rs` + `src/service/redis.rs`: cross-instance message
  relay (Redis pub/sub) so a send reaches a connection on another instance.
- `scripts/stale_connections.rs` (`stale_connections` bin): scans DynamoDB for
  connections past the 60s timeout; `README.md` has usage.

## Scope

- Owns: WebSocket connection tracking and message delivery to a connected
  entity, across instances; multiplexed document sync for local sockets.
- Document state and document-token authorization remain in `sync-service`.
  Other message/event payloads and send authorization remain with callers.

## Boundaries

- Depends on: `connection_gateway_models`, `macro_authorization`.
- Used by: nearly every other service, through `connection_gateway_client`
  (document_storage_service, document_cognition_service, email_service,
  calendar_service, agent_harness_service, mcp_service, scheduled_action,
  agent_trigger_service, preview_gateway, and domain crates like `channels`,
  `messages`, `databases`, `ai_tools`).

## Recipes

- Add a message/event type sendable over the gateway: `src/model/message.rs` →
  `src/api/message.rs` → `connection_gateway_client` (the crate callers use).
- Debug/clean stale connections: `scripts/stale_connections.rs` (see `README.md`).

## Checks

- `cargo test -p connection_gateway` (`SQLX_OFFLINE` unset).
- `cargo run --features local_auth` then connect on port 8085 (see `README.md`).

## Gotchas

- A send can target a connection on a different instance — it always goes
  through the Redis relay in `src/service/redis.rs`, never a direct in-process
  lookup. Sync replies are the exception: their router is owned by one local
  socket, so they go directly to that socket's queue.
- Resolve `SyncServiceUrl` at startup; Docker uses
  `OVERRIDE_SYNC_SERVICE_URL=http://sync-service:8787`.
- Complete the gateway rollout before enabling `sync-via-gateway` in PostHog;
  there is no separate router deployment. See `docs/architecture/sync-gateway.md`.

## Related

- Rules: `.agents/rules/config-and-service-urls.md`
