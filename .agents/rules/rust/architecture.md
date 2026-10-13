---
description: "Boundaries between crates and layers, and how handlers and APIs are shaped."
paths:
  - "crates/**/*.rs"
  - "services/**/*.rs"
  - "tooling/**/*.rs"
globs: "crates/**/*.rs,services/**/*.rs,tooling/**/*.rs"
alwaysApply: false
---

# Rust architecture and API design

Boundaries between crates and layers, and how handlers and APIs are shaped. IDs are stable; cite them in reviews.

- **CS-23** `[arch]` Do not grow `macro_db_client` — new domain logic gets a new crate;
  the catch-all crates must shrink, not accumulate. (#4380)
- **CS-24** `[arch]` Keep source files under ~1000 lines — split before a reviewer has
  to ask. (#4364)
- **CS-25** `[arch]` `mod.rs` declares submodules; it doesn't host logic — prefer the
  `foo.rs` + `foo/` file-and-directory style for modules with logic. (#4175 · enforced:
  ast-grep `rust-mod-rs-declarations-only`, error)
- **CS-26** `[arch]` Reuse before reimplementing — if the logic plausibly exists
  (service clients, permission checks, oauth utils, the `agent` crate), find it and
  reuse/extract it instead of writing a second copy. (#3692, #4020, #4380, #4485)
- **CS-27** `[arch]` Shared domain tables are only touched by their owning crate — e.g.
  `entity_access` mutations go through `entity_access`/`entity_access_db_utils`, never
  raw SQL elsewhere. (#3769)
- **CS-28** `[arch]` Don't extract single-use code into shared crates prematurely, and
  watch dependency direction: general-purpose crates must not import from specific ones.
  (#4410)
- **CS-29** `[arch]` Group proliferating root files (e.g. Dockerfiles) into a dedicated
  folder. (#4380)
- **CS-30** `[api]` Axum handlers take shared services via `State`, not `Extension`.
  (#4556 · enforced: ast-grep `rust-no-axum-extension-param`, warning)
- **CS-31** `[api]` Attach cross-cutting services to the owning domain service, not ad
  hoc at the router/handler layer — e.g. `EntityAccessManagementService` hangs off the
  email/document service itself, the way the documents crate does. (#4572)
- **CS-32** `[api]` New API/soup models mirror the shape of their existing counterpart:
  omit fields derivable from a nested field, keep lazily-loaded collections lazy,
  include only fields relevant to the new context. (#4165)
- **CS-33** `[api]` Trait methods every implementor must consciously declare get no
  default impl (e.g. schema version) — defaults are for genuine defaults, not escape
  hatches. (#4276)
- **CS-34** `[api]` Design generic abstractions to map `T -> U`, not just `T -> T`, when
  mapping is the point of the abstraction. (#4396)
- **CS-35** `[api]` Keep sibling endpoints on a resource using the same DTO shape;
  migrate them together rather than changing one in isolation. (#4386)
- **CS-51** `[arch]` Domain modules reference no infrastructure or transport: no AWS
  SDKs, redis, reqwest, opensearch, kafka, axum, or http types under `src/domain/**` —
  wrap clients in outbound adapters behind ports; response mapping lives in inbound.
  (enforced: ast-grep `rust-no-infra-in-domain` warning,
  `rust-no-transport-in-domain` error · also: cloud-storage-hexagonal-architecture
  skill)
- **CS-52** `[arch]` Dependencies point inward: `src/domain/**` never imports
  `crate::inbound`/`crate::outbound`, and `src/outbound/**` never imports
  `crate::inbound` — define a port in domain and implement it in the adapter.
  (enforced: ast-grep `rust-domain-no-adapter-imports` warning,
  `rust-outbound-no-inbound-imports` error)
- **CS-53** `[arch]` Inbound adapters run no database queries — handlers, tools, and
  listeners call a domain service backed by an outbound repository, never sqlx
  directly. (enforced: ast-grep `rust-no-sqlx-in-inbound`, warning)
