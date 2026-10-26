# universal_input

Read-only intent classification and editable field extraction for Command K.

- `src/domain.rs` owns admission, draft bounds, verbatim note preservation,
  and event timestamp validation/defaults. Providers interpret natural language;
  domain validation must not re-parse it with regexes. `domain/fallback.rs` owns provider failover policy.
- `src/outbound.rs` implements the field-extraction port through the shared
  model router; `outbound/clairic.rs` implements Cloudflare typed extraction.
- HTTP transport and provider configuration are wired by
  `services/agent_harness_service/src/cognition`.
- Suggestions contain display text, never authorized entity identifiers.
  Submission and permission checks belong to the destination services.
- Keep all public API documented; the crate denies missing documentation.

## Checks

- `cargo test -p universal_input` from the repository root with `SQLX_OFFLINE`
  unset.
- `just check`.
