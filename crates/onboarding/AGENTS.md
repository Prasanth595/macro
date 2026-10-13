# onboarding

The onboarding flow (`/setup`): one row per user tracking whether they are
still in the flow, plus the hook that starts import gather runs when
connectors authenticate during it.

## Start here

- `src/lib.rs`: crate doc comment — read it first, it states the boundary
  with `import` precisely.
- `src/domain/service.rs` + `src/domain/ports.rs`: flow state transitions and
  the ports they need.
- `src/outbound/pg_onboarding_repo.rs`: the single Postgres adapter.
- `src/inbound/axum_router.rs`: the `/setup` HTTP routes.

## Scope

- Owns: the per-user onboarding flag/state and starting auto-import gathers
  while onboarding is active.
- Not here: the import machinery itself (staging, dedup, gather/import jobs)
  → `import`.

## Boundaries

- Depends on: `import`, `mcp_client`, `mcp_select`, `generic_email_domains`,
  `macro_authorization`.
- Used by: `services/document_cognition_service`,
  `services/authentication_service` (onboarding deletes its row during
  account deletion).

## Checks

- `cargo test -p onboarding` (`SQLX_OFFLINE` unset; requires local MacroDB).

## Gotchas

- Account deletion must delete the `user_onboarding` row explicitly — it is
  not cascaded (see `fix(auth): delete user_onboarding row during account
  deletion`).

## Related

- Rules: `.agents/rules/rust/architecture.md`
