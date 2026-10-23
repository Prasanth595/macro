# cognition

## What it is

Shared AI generation and named yes/no decisions, exposed as a typed internal
client and optional tool adapters. The public SDK calls the ordinary cognition
HTTP endpoints directly; this crate does not register tools into a runtime.

## Start here

- `src/domain.rs`: authenticated-user port, model identifier and request bounds.
- `src/outbound.rs`: pooled HTTP adapter to the cognition service.
- `src/inbound/toolset.rs`: optional `GenerateObject` and `Decide` adapters.

## Scope

- Owns: bounded client requests, sanitized response mapping and tool contracts.
- Not here: provider execution, model access and generation metering →
  `services/agent_harness_service`; decision admission and classification →
  `crates/jev`.

## Boundaries

- Depends on Jev's shared decision types and Macro authenticated user identity.
- Composition roots supply the trusted service URL, internal credential and
  default model. Callers cannot select another user through tool inputs.

## Checks

- `cargo test -p cognition` (`SQLX_OFFLINE` unset).

## Gotchas

- No redirects or automatic retries: repeated requests can incur provider usage.
- Cancellation can stop waiting after provider work has begun; the remote
  service retains its metering responsibility.
- `generate_object` and `decide` consume supplied text only. `explore_object`
  may first search and read the caller's workspace through the cognition
  service's read-only workspace toolset; nothing in it writes.

## Related

- Rules: `.agents/rules/rust/architecture.md`, `.agents/rules/rust/security.md`.
- Skill: `cloud-storage-hexagonal-architecture`.
