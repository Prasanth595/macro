# <crate or directory name>

<One sentence: what this owns.>

Status: legacy — do not extend; use `<replacement>` | migrating to `<target>`

## Start here

- `src/<file>`: <why to read it first>

## Scope

- Owns: <responsibilities>
- Not here: <neighbouring responsibility> → `crates/<owner>`

## Boundaries

- Depends on: <ports, domain crates>
- Used by: <callers that matter>

## Recipes

- Add a <thing>: `<file>` → `<file>` → `<file>`

## Checks

- `cargo test -p <package>`
- If <condition>: `<command>`

## Gotchas

- <non-obvious invariant an agent would get wrong; link a rule instead of restating it>

## Related

- Rules: `.agents/rules/<file>` · Skills: `<skill>` · Docs: `docs/<file>`

<!--
Writing rules:
- Under ~50 lines; up to ~70 only for very large crates. Every line is something an agent would otherwise get wrong or
  spend time rediscovering.
- Nothing a file listing, the code, or a crate-level doc comment already says.
- Delete empty sections instead of filling them.
- Status: omit the line for active crates; include it only for legacy or migrating ones.
- Boundaries is for shared libraries and domain crates. For a leaf service, put its
  callers in Scope and drop the section. "Used by" names the callers that matter,
  not every dependent.
- Don't restate rules from .agents/rules; link them.
- A sibling CLAUDE.md is a symlink to this file: `ln -s AGENTS.md CLAUDE.md`.
-->
