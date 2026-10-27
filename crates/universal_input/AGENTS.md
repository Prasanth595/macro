# universal_input

Read-only intent classification and editable field extraction for Command K.

- `src/domain.rs` owns admission, draft bounds, verbatim note preservation,
  and event timestamp validation/defaults. `domain/temporal` resolves typed, source-backed
  temporal expressions against the request clock and timezone. Providers interpret natural language;
  domain validation must not re-parse it with regexes. `domain/fallback.rs` owns provider failover policy.
  Search extraction identifies filters before the remaining topic; typed and generative
  providers share `domain/extract_search_query_prompt.txt` so filter-only searches have no query.
- `src/outbound.rs` implements the field-extraction port through the shared
  model router; `outbound/clairic.rs` implements Cloudflare typed content extraction,
  rejects search field claims that reuse source occurrences, and
  `outbound/temporal.rs` extracts temporal facts with Nemotron.
- `src/inbound/axum_router.rs` owns authenticated HTTP routes. The harness root
  composes providers and mounts the router under `/universal_input`.
- Suggestions contain display text, never authorized entity identifiers.
  Submission and permission checks belong to the destination services.
- Keep all public API documented; the crate denies missing documentation.

## Checks

- `cargo test -p universal_input` from the repository root with `SQLX_OFFLINE`
  unset.
- `just check`.
- With model credentials configured, run the opt-in prompt regression with
  `cargo test -p universal_input search_query_excludes_consumed_filters -- --ignored`.
