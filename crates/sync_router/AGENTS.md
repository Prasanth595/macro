# sync_router

## What it is

Document sync routing library embedded in `connection_gateway`. Each authenticated
WebSocket owns a router and its downstream connections; there is no separate
service, Redis subscriber, or Pulumi stack.

## Start here

- `src/domain/router.rs`: document subscriptions, bounded queues, route epochs.
- `src/domain/ports.rs`: socket delivery and downstream lifecycle contracts.
- `src/outbound/do_downstream.rs`: scoped-token WebSocket dialing and frame pumps.
- `../../services/connection_gateway/src/service/sync.rs`: socket-owned task
  tracking, cancellation, and local delivery adapter.

## Scope

- Owns routing and cancellation, not document state or authorization.
- `services/sync-service` validates each document-scoped token and owns CRDT state.
- Browser envelopes are generated from `services/sync-service/bebop/schema.bop`.

## Checks

- `cargo test -p sync_router` (no live external services required).
- `cargo test -p connection_gateway --lib service::sync` exercises real local
  downstream sockets, isolation, backpressure, and cancellation.
- After dependency changes, regenerate and check `cargo x deps`.

## Gotchas

- Preserve inner chunk framing byte-for-byte. A full queue must close its route
  or socket and trigger resync; never drop a chunk and continue the stream.
- Dropping a downstream route cancels its task, including pending dials/writes.
- Every gateway replica handles only its own sockets. No distributed route
  ownership or singleton deployment is required.
- Deploy the updated gateway before enabling PostHog `sync-via-gateway`.
  `VITE_SYNC_VIA_GATEWAY=true` opts local clients in.
