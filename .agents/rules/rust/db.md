---
description: "Rust database rules: ids, keys, migrations, and SQLx."
paths:
  - "**/outbound/**"
  - "crates/*_db_client/**"
  - "crates/*db_utils/**"
  - "**/migrations/**"
  - "**/*.sql"
globs: "**/outbound/**,crates/*_db_client/**,crates/*db_utils/**,**/migrations/**,**/*.sql"
alwaysApply: false
---

# Database and migrations

Rust database rules: ids, keys, migrations, and SQLx. IDs are stable; cite them in reviews.

- **CS-01** `[db]` Generate ids as UUIDv7 in application code — never `gen_random_uuid()`
  (UUIDv4); v7 ids sort by creation time. (#4296)
- **CS-02** `[db]` Make seed/backfill inserts and anything that can race idempotent with
  an `ON CONFLICT` handler. (#4296, #4498)
- **CS-03** `[db]` Prefer natural/composite keys over surrogate ids when the table is
  queried/sorted by those columns anyway, and key REST routes on the natural id.
  (#4296, #4498)
- **CS-04** `[db]` Name user columns `user_id` — not `owner_user_id` or other variants;
  follow existing tables. (#4498)
- **CS-05** `[db]` New tables need a deliberate cascade/cleanup story, not whatever the
  default happens to be. (#4296)
- **CS-06** `[db]` Don't add redundant indexes — a column already covered as the leading
  part of the primary key does not need its own index. (#3961)
- **CS-07** `[db]` Don't store columns that are implicit in context (e.g. a scoping id
  already fixed per durable object / per tenant). (#3961)
- **CS-08** `[db]` Use `sqlx::query!` / `query_as!` (compile-time checked) by default;
  the non-macro form is only for queries that genuinely cannot be statically known.
  (#4156 · enforced: clippy `disallowed-methods` · workflow: [database development](../../../docs/development/database.md))
- **CS-09** `[db]` The `.sqlx` cache lives at the workspace root — run
  `nix develop --command just prepare_db` from the repository root; never commit a
  `.sqlx` directory inside an individual crate. (#4577 · workflow: [database development](../../../docs/development/database.md))
