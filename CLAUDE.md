# Repository guide for coding agents

Macro is a document and collaboration app with a Rust backend and a web frontend.
This file is the shared entry point: `AGENTS.md` symlinks to `CLAUDE.md`. Edit
`CLAUDE.md` and preserve the symlink; do not maintain two copies.

## Start here

1. Identify the affected app, service, or crate using the map below.
2. Read any applicable directory-level `AGENTS.md` / `CLAUDE.md` before editing.
3. Read the task-relevant guides below, not every linked document.
4. Follow [the style guide](docs/development/style-guide.md) for the language you change.
   Prefer its current rules over patterns in older code.

## Repository map

| Path | Contents |
| --- | --- |
| `apps/web/` | Web frontend; its own agent guide covers Bun, UI patterns, and browser verification. |
| `apps/`, `packages/` | Other apps and shared frontend packages. |
| `services/` | Deployable services and workers; Rust package names come from each `Cargo.toml`. |
| `crates/` | Reusable backend libraries, domain services, and adapters. |
| `crates/macro_db_client/migrations/` | MacroDB PostgreSQL migrations. |
| `infra/` | Deployment definitions and local infrastructure. |
| `tooling/` | Development tools, scripts, and imported `just` recipes. |
| `docs/` | Development guides, architecture, designs, runbooks, and the browser agent guide; see [the index](docs/README.md). |

## Where agent guidance lives

| Path | Contents |
| --- | --- |
| `AGENTS.md` in a directory | Scope, map, checks, and gotchas for that subtree; a sibling `CLAUDE.md` symlinks to it. |
| `.agents/skills/` | Task workflows. `.claude/skills` symlinks here. |
| `.agents/rules/` | Path-scoped conventions, loaded when you touch matching files. `.claude/rules` and `.cursor/rules` symlink here. |
| `.agents/templates/` | Templates for new rules and `AGENTS.md` files. |
| `rules/ast-grep/` | Mechanically enforced code rules, run by `just check`. |

Real files live in `.agents/`; tool-specific directories only symlink to it.

## Read when relevant

| Task | Guide |
| --- | --- |
| Reusing database storage or separating it from an app entity | [Database core skill](.agents/skills/database-core/SKILL.md) |
| Adding collaborative markdown to a feature | [Collab surface core skill](.agents/skills/collab-surface-core/SKILL.md) |
| Rust code, builds, or tests | [Rust development](docs/development/rust.md) |
| SQLx queries, migrations, DB tests, or cache errors | [Database development](docs/development/database.md) |
| Web frontend | [Web agent guide](apps/web/AGENTS.md) |
| Email body rendering or snapshots | [Standalone renderer](packages/email-renderer/README.md) |
| Running the frontend or backend on a local machine | [Running locally](docs/development/running-locally.md) |
| Working inside Cursor Cloud | [Cursor Cloud](docs/development/cursor-cloud.md) |
| Driving the app through a browser | [App agent guide](docs/agent-guide/README.md) |
| SDK version bumps and npm publishing | [SDK release guide](packages/sdk/RELEASING.md), [release-sdk skill](.agents/skills/release-sdk/SKILL.md) |
| Deployment | [Infrastructure guide](infra/README.md) |

## Essential guardrails

- Run Rust tests from the repository root with `cargo test -p <package>` and
  **leave `SQLX_OFFLINE` unset**. Offline mode is for checks/builds/lints, not tests.
- Generate migrations with `sqlx migrate add`; never invent timestamped filenames.
  Never hand-edit `.sqlx/query-*.json`. Prepare the workspace cache from the root
  inside Nix; see the database guide for the workflow and test-query flags.
- Do not reset databases or wipe stack volumes to troubleshoot without explicit
  approval. Database and Cloud guides distinguish rebuilds from destructive resets.
- On a local machine, frontend-only work uses `apps/web` against the dev backend;
  it does not need a local Rust stack. `.cursor/*.sh` scripts are **Cursor Cloud
  only**, not local-machine setup commands. Treat hosted dev data as real data.
- Load Rust configuration through `macro_env_var` / `macro_config`, never
  `std::env::var` or hand-rolled wrappers. Register new env vars in Doppler; never
  paste secrets into chat or commit them.
- Across domain crates, depend on the owning domain service or port; only a
  composition root may construct that crate's outbound adapters. Never import
  another crate's `outbound` module from an outbound adapter.
- Use `\cd` instead of `cd` to bypass repository shell aliases.

## Before handing off

- Always use Conventional Commit syntax for PR titles: `type(scope): description`
  (scope optional), for example `fix(onboarding): preserve team inputs`.
- Test the affected packages/services individually before committing. Use the
  relevant guide for setup; there is no root `just test` recipe.
- For code changes, run `just check` (format/lint/code rules scoped to changes).
  `just check full` adds TypeScript checking and Rust clippy; `just rust-check` is
  the workspace Rust type check. These checks do not replace tests.
- Exercise user-visible changes in a browser. If routes, creation flows, editors,
  AI surfaces, or composer behavior change, update the corresponding
  [app agent guide](docs/agent-guide/README.md) in the same change.
- Report what you tested and any checks blocked by the environment.

## Keeping these instructions useful

Keep this file short: shared guardrails and links with explicit reading triggers.
Put workflows in the relevant guide, coding rules in `docs/development/style-guide.md`, and
subtree-specific instructions near their code. Do not append implementation
journals, duplicate command lists, or environment-specific runbooks here.

When the user corrects something that would apply beyond the current change, add
or update a rule in `.agents/rules/<area>/` from the
[rule template](.agents/templates/rule.md), scoped to the narrowest paths that
need it. If the rule can be checked mechanically, write an ast-grep rule instead.
