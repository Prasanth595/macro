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

Deploy two tasks in both environments, with overlapping rolling replacements.
Preview ownership, replica heartbeats, and credential hashes are stored in
Postgres. The task accepting SSH owns that tunnel; browser HTTP/WebSocket
requests arriving on another task stream directly to the owner's private HTTP
endpoint. Keep security-group self-ingress on TCP 8111. Live SSH tunnels remain
local to their owner; replacing that owner can close its active previews.

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

## Prepare preview stack outputs

Harness previews require the preview network IDs to be published first. Prepare
an update from the existing preview deployment that adds only these exports,
retaining its current compute and networking:

```ts
export const previewTaskSecurityGroupId = taskSg.id;
export const previewControlTargetGroupArn = control.target_group.arn;
export const previewHttpTargetGroupArn = httpTarget.arn;
export const previewSshTargetGroupArn = sshTarget.arn;
```

Preview an update targeting only the preview stack's root Stack resource and
save its plan. Verify that every resource operation is unchanged before applying
that exact plan with the same target. This publishes stack metadata and still
requires explicit deployment approval. Apply the network-only program during
the coordinated cutover below.

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
   Apply additive migration `20261021205701_agent_preview_replication.sql`
   before starting the combined process.
2. Pause deployments for the chosen environment, cancel queued deployments,
   and wait for running deployments to finish. Disabling future triggers does
   not clear queued runs. In dev, every main push deploys all enabled services;
   workflow concurrency does not
   serialize manual Pulumi updates. An older deployment can restore retired
   services or overwrite the combined harness. Keep deployments paused until
   the deployed resources and merged source agree.
3. Prepare an isolated staging checkout of this change. Temporarily omit the
   harness's three `sharedApiRules` and their `dependsOn` entries, and omit
   its preview control/HTTP/SSH target-group attachments. Keep the existing
   API/egress attachments, preview security group, two replicas, and rolling
   replacements. Preview and apply this staged harness while the old feature
   services remain live. Explicitly wait for two healthy combined tasks:
   `continueBeforeSteadyState` means Pulumi completion alone is insufficient.
4. In that checkout, restore the three feature rules with their final logical
   resource names, temporarily using verified unused priorities numerically
   lower than the old rules. Keep preview target attachments omitted. Preview
   and apply this routing update only after the combined tasks are healthy.
   The new rules transfer gateway traffic to those tasks while the old rules
   and services still exist. Verify authenticated requests through each prefix.
5. Apply the retired `mcp-server` and `agent-schedule-service` stack programs,
   then `document-cognition` (directory `document-cognition-service`). Remove
   their old ECS services and rules, plus cognition's refresh Lambda/EventBridge
   rules, retaining the projection queue and DLQ. The temporary harness rules
   continue serving traffic. The retired MCP and scheduler stacks are no longer
   automatic service builds; do not destroy the shared gateway or database.
6. Apply network-only `preview-gateway`, removing its ECS task while retaining
   the domain, certificates, HTTPS/SSH load balancers, security group, and target
   groups. Preserve the control target group's default port to avoid replacing
   it. Wait for the old preview service and its target registrations to drain
   before attaching those target groups to the harness. Preview downtime is
   expected during this handoff.
7. Preview and apply the final source, restoring the harness rules' intended
   priorities and attaching all three existing preview target groups. ECS
   registers preview control targets on API port 8101 using an explicit port
   override; health checks use that port. Verify the saved plan updates the
   existing rules and target groups without replacing them. Wait for two
   healthy harness tasks and all five target groups to be healthy.
8. Check OAuth discovery and authentication, chat/completions, routine
   dispatch, and a complete preview SSH/browser handoff. Verify tracing across
   the shared HTTP boundaries and confirm no retired agent ECS service or
   refresh Lambda remains. Merge the final source and resume deployments.
   For dev, re-enable `Deploy on Push` and dispatch `Deploy All Services` on
   merged `main` with `environment=dev`; pushes made while paused are not replayed.

Retain the final logical rule names throughout staging so temporary priorities
update in place. ALB priorities are unique: do not apply the final priorities
until the old rules are removed. Preserve resource-only stacks rather than
recreating durable queues or preview DNS/certificates in another stack.

This sequence protects gateway URLs. Old direct cognition/MCP hostnames need a
separate DNS/client cutover or explicitly prepared compatibility routing; their
traffic does not pass through the gateway rules above.

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
