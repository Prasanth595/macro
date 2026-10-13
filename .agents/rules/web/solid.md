---
description: "State ownership, reactivity, and async error handling."
paths:
  - "apps/web/**"
  - "packages/**"
globs: "apps/web/**,packages/**"
alwaysApply: false
---

# Solid reactivity and async

State ownership, reactivity, and async error handling. IDs are stable; cite them in reviews.

- **FE-08** `[solid]` No ad-hoc global state modules — shared state for a subtree lives
  in a Context scoped to a clear ownership boundary. (#3750 · also: AGENTS.md)
- **FE-09** `[solid]` Derive, don't sync — an effect that only copies one signal into
  another similarly-shaped signal should be a derived signal at the appropriate level.
  (#3898)
- **FE-10** `[solid]` `createEffect` is for external/imperative systems only (DOM APIs,
  third-party libs, navigation events) — never for deriving state; use `on()` to make
  dependencies explicit when an effect is warranted. Prefer wrapping the setter over
  `createEffect(() => { if (signal()) sideEffect() })` when setting a value should also
  clear related UI, blur a control, or scroll. (#3750, #3898, #6038 · also: AGENTS.md)
- **FE-11** `[solid]` Check `solid-primitives` before writing a custom reactive utility.
  (also: AGENTS.md)
- **FE-12** `[async]` `async`/`await` with `try`/`catch`, not `.then()`/`.catch()`
  chains. (#3716, #3781 · enforced: oxlint `promise/prefer-await-to-then` —
  `bun run lint:oxlint` from the repository root)
- **FE-13** `[async]` Extract multi-step async coordination into named helper functions,
  and make intentionally-unawaited promises explicit — no bare floating promises.
  (#3781)
- **FE-14** `[async]` Keep neverthrow `Result`/`ResultAsync` intact end-to-end — use the
  existing helpers (`ResultAsync`, `throwOnError` in `queryOptions`, `catchToResult`)
  instead of ad hoc `Promise <-> Result` conversions. (#3781, #4373)
- **FE-15** `[async]` Guard once, at the top — missing/invalid state gets an early
  return at the start of the function or hook, not a repeated check in every branch or
  a silent fall-through. (#3750, #4057)

## Solid patterns

- Avoid createEffect. Legitimate uses: syncing with external/imperative systems (DOM APIs, third-party libs). If you're using it to derive state or trigger updates, use a derived signal or wrap the setter instead.
- Prefer wrapping the setter over `createEffect(() => { if (signal()) sideEffect() })`. When setting focus/selection should also clear another stop, blur a control, or scroll, put that work in the setter (or a named helper the setter calls) so the action is explicit at the call site — not a distant effect watching the signal.
- Use createMemo only when you need referential stability or the derivation is expensive. Cheap derivations (() => a() + b()) don't need it regardless of subscriber count.
- Before rolling your own reactive utility, check solid-primitives first.
- Never read a solid-query `query.data` unguarded from a component body or an eager `createMemo`. `data` is a resource read: while the query is pending it suspends the caller's nearest `<Suspense>`, which detaches and re-attaches that whole subtree — a blank flash, lost scroll position, remounted editors. Gate the read on status (`query.isSuccess ? query.data : fallback`, or `queryReadyGate` from `src/lib/queries/gate.ts`); an `isLoading` check is not enough, because a disabled or paused query is pending without loading and its data read still suspends. Every other field is a plain store read and is safe. Remember `createMemo` runs immediately, so a guard inside a `<Show>`/`<Match>` further down does not save you. This has blanked the calendar grid twice — see `focusTarget` in `src/features/block-calendar/CalendarBlockAdapter.tsx` and `useSystemSkillsQuery`.
