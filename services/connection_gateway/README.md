# Connection Gateway

A service responsible for managing connections, and allowing services to send messages to a specific entity over a websocket connection.

## Document sync

Binary WebSocket messages use the Bebop `ToRouter` / `FromRouter` envelope.
Each socket embeds `crates/sync_router`, which opens one downstream sync-service
connection per document and passes the inner chunked protocol unchanged.
Document tokens are validated by the sync service. Closing the client socket
cancels all of its downstream work, including in-flight handshakes.

This ships in the existing gateway deployment. No additional service, Redis
fanout, or Pulumi stack is needed. `SyncServiceUrl` selects the existing dev/prod
sync origin; local Docker overrides it with `OVERRIDE_SYNC_SERVICE_URL`.
Deploy all gateway replicas before enabling PostHog `sync-via-gateway`.
See [sync gateway architecture](../../docs/architecture/sync-gateway.md).

## Local Development
*runs on port 8085*

```bash
cp .env.sample .env
cargo run --features local_auth
```

## Utility Scripts

### Stale Connections

This utility scans the DynamoDB table for stale WebSocket connections using the same timeout logic as the service (60 seconds).

#### Running the script:

```bash
# Basic usage - shows statistics only
cargo run --bin stale_connections -- your-table-name

# Using environment variable
export CONNECTION_GATEWAY_TABLE=your-table-name
cargo run --bin stale_connections

# Delete stale connections (with confirmation prompt)
DELETE_STALE=1 cargo run --bin stale_connections -- your-table-name
```
