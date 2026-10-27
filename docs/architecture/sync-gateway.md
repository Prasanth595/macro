# Document sync through the connection gateway

The browser multiplexes document sync over one WebSocket when PostHog flag
`sync-via-gateway` is enabled. The existing connection gateway hosts the router
as the `sync_router` Rust library. There is no additional deployable service.

```text
Browser: virtual document sockets
           |
           | WebSocket / Bebop ToRouter and FromRouter envelopes
           v
connection_gateway replica
  authenticated socket
    -> socket-owned router
    -> one downstream WebSocket per subscribed document
           |
           | existing chunked sync protocol and scoped document token
           v
sync-service / document Durable Object
  token authorization, CRDT state, persistence
```

Each authenticated client socket owns an independent router, outbound queue, and
set of tracked downstream tasks. Replicas do not subscribe to a shared broadcast
channel. Reconnecting to another replica creates a new router and resubscribes;
there is no shared routing state to transfer. Existing JSON gateway messages
retain their cross-instance Redis relay.

Routing reads the document id from the outer Bebop envelope. The inner payload,
including the large-message chunk prefix, passes through unchanged. Tokens are
forwarded only to the configured sync origin; the sync service validates them.

Unsubscribing cancels that document's downstream, including a pending handshake.
Client disconnect cancels and joins all routing work for that socket. A full
outbound socket queue closes the client connection; a full downstream queue
closes that document route. Clients reconnect and resynchronize, rather than
continuing a stream with missing chunks. Other sockets are unaffected.

The gateway resolves `macro_service_urls::SyncServiceUrl` at startup. Hosted dev
and production use the existing sync-service origins; local Docker sets
`OVERRIDE_SYNC_SERVICE_URL=http://sync-service:8787`. No new secret or Pulumi
resource is needed. Overrides must be HTTP(S) origins without credentials,
non-root paths, queries, or fragments. Deploy the updated gateway to every
replica before enabling `sync-via-gateway`. The frontend selects its transport
when a sync source is created; rollout updates do not move existing sessions.
The env override `VITE_SYNC_VIA_GATEWAY=true` enables local testing.
