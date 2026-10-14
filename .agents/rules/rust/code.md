---
description: "Type design, idioms, errors and observability, performance, and tests."
paths:
  - "crates/**/*.rs"
  - "services/**/*.rs"
  - "tooling/**/*.rs"
globs: "crates/**/*.rs,services/**/*.rs,tooling/**/*.rs"
alwaysApply: false
---

# Rust code

Type design, idioms, errors and observability, performance, and tests. IDs are stable; cite them in reviews.

- **CS-10** `[types]` Newtype your identifiers and tokens — wrap raw `String`
  ids/tokens/model-ids in a validated newtype that checks shape at construction.
  (#4020, #4077, #4276)
- **CS-11** `[types]` A closed set of string values is an enum, not a `String` — impl
  `Display`/`FromStr` as needed. (#4296, #4410)
- **CS-12** `[types]` Optional means `Option<T>` — don't rely on sentinel values or
  convention to express absence. (#4296)
- **CS-13** `[types]` Model tri-state data (not-loaded / missing / present) as one flat
  enum, not nested `Option`s or ad-hoc flags. (#4527)
- **CS-19** `[err]` Give third-party errors their own variant — don't collapse e.g. a
  `jsonwebtoken` failure into a generic internal error. (#4020)
- **CS-20** `[err]` Depending on a rate-limited external provider requires a fallback
  (fallback model, retry story, or documented degradation). (#4296)
- **CS-21** `[err]` Wire usage metering on every invocation path — MCP-triggered tool
  calls count too, not just the primary path. (#4296)
- **CS-22** `[err]` When adding `#[tracing::instrument]`, include `err` on `Result`
  functions and omit it on other return types. Never set `level = "info"` on the
  attribute. Log errors as structured fields (`tracing::error!(error=?e, "msg")`);
  prefer `.inspect_err` over `if let Err(e)` for logging.
- **CS-40** `[rust]` Repeated literals become named consts. (#4020)
- **CS-41** `[rust]` Don't use `#[allow(...)]` — use `#[expect(..., reason = "...")]`
  on the narrowest item it applies to; `allow` silently rots when the lint stops firing,
  `expect` warns. (#4396, #4647)
- **CS-42** `[rust]` Don't re-state trait bounds already implied by a supertrait. (#4276)
- **CS-43** `[rust]` Use the smallest sufficient integer type — a version counter that
  can't plausibly pass 255 is a `u8`. (#4396)
- **CS-44** `[rust]` Large inline strings belong in files — use `include_str!`. (#4156)
- **CS-45** `[rust]` CLI binaries use `clap`, not hand-rolled arg parsing. (#3678)
- **CS-46** `[rust]` Use `rootcause` for error handling in new code — it's preferred
  over `anyhow` these days. In code that's still on anyhow, prefer `bail!` for early
  error returns.
- **CS-47** `[perf]` Keep latency-critical services thin: push bytes directly instead of
  round-tripping through presigned URLs or extra services; dispatch non-blocking
  background work with `wait_until`. (#3781)
- **CS-48** `[perf]` Don't do per-message work on hot websocket paths — accumulate and
  flush on a timer/alarm. (#3961)
- **CS-49** `[test]` Tests live in a sibling `test.rs`, not inline `#[cfg(test)]` blocks
  in the implementation file. (#4647 · example: [Rust development](../../../docs/development/rust.md#test-the-affected-packages))
- **CS-50** `[test]` Update affected tests for db-crate changes. Refresh SQLx metadata
  when queries/schema change or required cache data is missing, not for unrelated
  Rust-only edits. Run affected tests with `SQLX_OFFLINE` unset.
  (workflow: [database development](../../../docs/development/database.md))
- **CS-54** `[rust]` New crates put `#![deny(missing_docs)]` in `lib.rs` and document
  all public items. Do not mark documentation code blocks `ignore` to skip doctests
  unless explicitly directed.
- **CS-55** `[err]` AI spans follow the OpenTelemetry GenAI conventions (`gen_ai.*`,
  see `crates/genai_telemetry`). Agent sessions of every harness are traced in one
  place: the session actor projects each session's ACP frames onto `invoke_agent` /
  `execute_tool` spans (`crates/agent_session/src/domain/session/telemetry.rs`), so
  do not add GenAI spans to a harness runtime — `agent_inmem` runs its agent loop with
  `with_genai_telemetry(false)` for that reason. Outside sessions (chat in
  `document_cognition_service`), the agent loop and `ai_toolset::ToolSet::try_tool_call`
  emit and enrich the `invoke_agent` / `chat` / `execute_tool` spans; do not open tool
  spans in tools or toolsets, and never record prompts, tool arguments or tool results
  as span fields or logs — they are content, recorded on the spans under the
  `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` policy and a size budget.
- **CS-68** `[types]` Don't mark types `#[non_exhaustive]` by default. Exhaustive
  matches are how a new variant reaches every place that must handle it; reserve
  the attribute for types published outside the workspace.
- **CS-69** `[types]` Derive serde, schema, and other traits on the type itself.
  Don't keep parallel copies (a `wire.rs` mirror of domain types) just to carry
  derives; add a separate type only when the wire shape genuinely differs.
