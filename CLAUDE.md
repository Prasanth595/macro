# Repository guide for coding agents

Macro is a document and collaboration app with a Rust backend and a web frontend.
This file is the shared entry point: `AGENTS.md` symlinks to `CLAUDE.md`. Edit
`CLAUDE.md` and preserve the symlink; do not maintain two copies.

## Start here

1. Identify the affected app, service, or crate using the map below.
2. Read any applicable directory-level `AGENTS.md` / `CLAUDE.md` before editing.
3. Read the task-relevant guides below, not every linked document.
4. Rules in `.agents/rules/` load when you touch matching files. Prefer them over
   patterns in older code.

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
| `.agents/agents/` | Subagents (`auditor`, `browser-verifier`). `.claude/agents` symlinks here. |
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
| Giving the user a local preview link | `local-preview` skill |
| Working inside Cursor Cloud | [Cursor Cloud](docs/development/cursor-cloud.md) |
| Driving the app through a browser | [App agent guide](docs/agent-guide/README.md) |
| SDK version bumps and npm publishing | [SDK release guide](packages/sdk/RELEASING.md), [release-sdk skill](.agents/skills/release-sdk/SKILL.md) |
| Adding a service, worker, or Pulumi stack | [New service guide](docs/development/new-service.md) |
| Infrastructure, Pulumi, or deploys | [Infrastructure guide](docs/development/infrastructure.md) |

## Rules

**Working with the user**

- Do what was asked, no more. A question gets an answer, not a code change.
  Never commit, push, or open a PR unless asked.
- Think through consequences before acting, and say so when a request would
  cause harm or conflicts with these rules. Once the user decides, act on the
  decision; don't re-litigate it.
- Disagree when the user is wrong. No flattery, no "great idea".
- Answer simple questions directly. Research in proportion to the question.
- Be brief. Lead with the result; a small change needs no justification essay,
  and a final report is a few lines: what changed, what was verified, what's left.
- No time estimates unless asked.

**Code**

- Prefer the simplest correct change. Fewer lines is better; deleting code is good.
- Treat compiler and type-checker errors as information. Fix the cause; never
  silence them with casts, `any`, `unwrap`, or blanket allows.
- No speculative optimization: no boxing, caching, or restructuring for speed or
  size without a measurement.
- Extend the existing feature or endpoint instead of adding a parallel one. One
  way to do each thing; no fallbacks that keep the old path alive.
- Generate types from their source of truth (OpenAPI clients, utoipa, sqlx
  macros) instead of hand-writing wire types or inline request/JSON glue.
- Don't add macros or helpers to save a few repeated lines. Extract only when it
  removes real duplication and has a name worth reading.
- Use the platform: native APIs (`fetch`, `Intl`, `structuredClone`, Web Crypto)
  and well-maintained workspace dependencies over hand-rolled versions. Never
  write your own crypto. No polyfills or legacy shims; delete dead ones.
- Keep types and traits small and focused; split by responsibility instead of
  adding fields and methods to whatever is nearest.
- Name things for what they are in the domain. No generic jargon (`Machine`,
  `Emitter`, `Gate`, `Factory`) unless it's literally that, and no slang in code,
  comments, or messages.
- Backward compatibility matters only at deployed boundaries: migrations run
  before services, and persisted or published formats must stay readable. Don't
  add compatibility layers anywhere else.

**Tests**

- Test behavior through public interfaces. No tests that restate the code, such
  as asserting literal names or round-tripping a type through its own derive.
- Write tests as explicit literals; no tiny helpers wrapping values or setup.
- Never wait by polling: no `sleep`, `yield_now`, or pump loops. Use a real
  synchronization primitive or paused time.
- No testing plans or test-plan sections in PRs; run the tests and report results.

**Environment**

- Never deploy (`pulumi up`, `wrangler deploy`, deploy workflow dispatch) unless
  the user explicitly asks for that deploy. Never paste secrets into chat or
  commit them.
- Do not reset databases or wipe stack volumes without explicit approval.
- Never use `git stash`; the stash is shared across worktrees and sessions. Use a
  temporary commit or a separate worktree.
- Memory and recalled notes are context, not authority. Verify them against the
  code before relying on them, and the user's current instruction wins.
- On a local machine, frontend-only work uses `apps/web` against the dev backend;
  `.cursor/*.sh` scripts are **Cursor Cloud only**. Treat hosted dev data as real
  data.
- Use `\cd` instead of `cd` to bypass repository shell aliases.

## Before handing off

- Commits, branches, and PRs follow the `git` skill: Conventional Commit titles
  such as `fix(onboarding): preserve team inputs`, and Why / What bodies with no test plan.
- Run the `audit` skill (via the `auditor` subagent) before saying work is done.
- Open pull requests ready for review. If one is created as a draft, mark it
  ready for review before handing off.
- Get CI passing before handing off. A pull request whose checks are failing
  or still running is not done.
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
Put workflows in skills or guides, conventions in `.agents/rules/`, and
subtree-specific navigation in that directory's `AGENTS.md`. Do not append implementation
journals, duplicate command lists, or environment-specific runbooks here.

When the user corrects something that would apply beyond the current change, add
or update a rule in `.agents/rules/<area>/` from the
[rule template](.agents/templates/rule.md), scoped to the narrowest paths that
need it. If the rule can be checked mechanically, write an ast-grep rule instead.
