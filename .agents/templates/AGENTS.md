# <crate or directory name>

<One sentence: what this owns.>

## Scope

- Owns: <responsibilities>
- Does not own: <neighbouring responsibility> (`crates/<owner>`)

## Map

- `src/<path>`: <only what names don't already say: entry points, ports, adapters>

## Checks

- `cargo test -p <package>`
- <area-specific steps: sqlx prepare when queries change, regenerate clients, etc.>

## Gotchas

- <non-obvious invariants; link `.agents/rules/` instead of restating them>
