# Consolidate agent services

`agent_harness_service` is the sole agent process and ECS service. It hosts the
existing session API, cognition APIs, public workspace MCP and OAuth, routine
scheduling, preview control/public HTTP/SSH, and projection refresh sweeps.
Connection gateway remains the app-wide realtime service.

The browser API prefixes stay `/agent-harness`, `/cognition`,
`/scheduled-action`, `/preview`, and `/mcp`. Session egress keeps its separate
listener and `/agent-harness-egress` prefix. Preview public HTTP (8111) and SSH
(2222) are listeners in the same process, preserving the isolated preview
browser domain. The main API port is 8101 in ECS and 8080 inside local Compose.

Deploy one task, with zero overlapping replacement tasks. Preview leases,
SSH tunnels, and tickets share an in-memory registry. Restarting the task
closes previews and briefly interrupts all agent API surfaces.

## Configuration

Configure encrypted `doppler:dopplerToken` in the harness Pulumi stack for the
chosen environment before previewing or deploying it. The preview stack's
provider credential does not transfer automatically between stacks.

Every config is loaded at startup from the harness's `APP_SECRETS_JSON`.
The harness Doppler validation binary validates the harness, cognition,
scheduling, and preview config structs against the same project.

Merge the old projects without logging their values:

```sh
python tooling/scripts/consolidate-agent-config.py --config dev
python tooling/scripts/consolidate-agent-config.py --config dev --apply
```

The same script accepts `--config prd` for an explicitly authorized production
cutover. It keeps existing harness values, fills missing integration values,
and sets the public MCP and connection-callback bases to the gateway URLs.
It also moves the Pipedream webhook URL to the gateway while retaining its
existing secret query parameter.
Preserve the preview SSH host key and MCP credential encryption key; replacing
them breaks pinned clients and stored credentials.

`MCP_PUBLIC_URL` is the public server base ending in `/mcp`.
`MCP_CLIENT_PUBLIC_URL` is the outbound integration callback base ending in
`/cognition`. The former services used `MCP_PUBLIC_URL` for both meanings.
Local instance generation sets both values separately and sets `APP_BASE_URL`
to the instance's frontend origin. The `local/lcl_personal` Doppler config also
contains the renamed client setting.

`POSTHOG_API_KEY` and `POSTHOG_HOST` are already typed harness fields. They
remain available for existing feature flags and future analytics. No MCP
analytics events or tracking client are added by this consolidation.

## Deployment cutover

This code does not stop or remove currently deployed resources by itself.
Perform the following only as an explicitly authorized deployment, in a
maintenance window:

1. Merge and validate the destination Doppler configuration for the chosen
   environment. Wait for the Doppler Secrets Manager sync to include the new
   keys in `APP_SECRETS_JSON`; writing Doppler is not proof that its sync has
   completed. Verify public OAuth clients accept the gateway callback URLs.
   In particular, apply the updated Slack manifest and ensure FusionAuth
   permits the public MCP gateway callback already listed in its stack.
2. Apply the retired `mcp-server` and `agent-schedule-service` stack programs
   to remove their ECS services and gateway listener rules. These retired
   stacks are no longer automatic service builds; do not destroy the shared
   gateway or database.
3. Apply `document-cognition` (directory `document-cognition-service`) to
   remove cognition ECS and its refresh Lambda/EventBridge rules, retaining
   the existing projection queue and its DLQ. The harness runs the same
   refresh sweeps at six-hour, daily, and three-day intervals.
4. Apply `preview-gateway` to remove its ECS task while retaining the existing
   domain, certificates, HTTPS/SSH load balancers, security group, and target
   groups. It now exports those resources for the harness task. Their health
   checks use the shared harness API port.
5. Apply `agent-harness-service`. Its one task joins the preview security group
   and all five target groups: shared API, egress, preview control, preview
   HTTP, and preview SSH. The shared API target also receives cognition, MCP,
   and scheduling listener rules at the retired services' existing priorities.
6. Check OAuth discovery and authentication, chat/completions, routine
   dispatch, and a complete preview SSH/browser handoff. Verify tracing across
   the shared HTTP boundaries and confirm that no retired agent ECS service
   or refresh Lambda remains.

Retire the old listener rules before deploying the new ones: ALB priorities
are unique. Preserve resource-only stacks rather than recreating durable
queues or preview DNS/certificates in another stack. Switching old direct
cognition/MCP hostnames also requires a DNS/client cutover; the supported API
bases after consolidation are the gateway prefixes above.

Automatic deployment of the consolidated service requires this one-time
cutover first. Do not merge and rely on an unordered parallel deployment to
retire old rules while creating their replacements.

## Local verification

The Compose inventory builds only `agent_harness_service` for these agent
features. The proxy forwards the preserved feature prefixes to that container;
preview HTTP and SSH ports are published by it. SDK local port maps and the
web app's direct local URLs use the shared host port with each feature prefix.

Use an isolated, migrated test database and run the affected packages:

```sh
cargo test -p agent_harness_service -p scheduled_action -p mcp_auth_proxy
cargo test -p macro_service_urls -p xtask_local
just check
bun run --cwd infra check
```

The feature implementations and SQL remain in their existing domain/adapters;
only composition, hosting, readiness, and shutdown ownership change. Authorization
continues through each feature's original services and typed access receipts.
