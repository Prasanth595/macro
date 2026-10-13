---
description: "Queries, caching, and where data is fetched."
paths:
  - "apps/web/**"
  - "packages/**"
globs: "apps/web/**,packages/**"
alwaysApply: false
---

# Frontend data fetching

Queries, caching, and where data is fetched. IDs are stable; cite them in reviews.

- **FE-01** `[data]` Never call a service client outside the `queries` package — UI code
  calling an endpoint directly is usually re-fetching data an existing query already
  caches. (#3750, #3961 · enforced: ast-grep `ts-no-service-client-outside-queries` +
  `tsx-no-service-client-outside-queries`, warning · also: AGENTS.md)
- **FE-02** `[data]` Every query module has a `keys.ts` structured like the existing
  ones. (#3710)
- **FE-03** `[data]` Conditional fetching uses a debounced signal passed to TanStack
  Query's `enabled`, not a custom resource. (#3961)
- **FE-04** `[data]` Pre-populating data means exposing a cache-seeding method on the
  query, not an ad hoc manual cache. (#4020)
- **FE-05** `[data]` Data-dependent UI that must not suspend uses `queryReadyGate`.
  (#4077)
- **FE-06** `[data]` Extend `QUERY_FILTERS_BASE` instead of re-deriving filter
  exclusions per query, and prefer explicit include lists — exclude lists silently break
  when a new entity type is added. (#3947, #4260)
- **FE-07** `[data]` Don't hardcode backend-owned config in the frontend (e.g. system
  bot config) — fetch it dynamically or generate types from the backend source of
  truth. (#3692)
- **FE-29** `[data]` Every new query call site (`useQuery`/`useInfiniteQuery` or a hook
  from `src/lib/queries/**`) needs a deliberate `Suspense` boundary: reading
  `query.data` suspends to the *nearest ancestor* boundary. When reviewing, walk up
  the component tree from the call site and determine which boundary would catch it.
  If none exists below the app root, or the nearest one is far outside the component's
  own UI scope (e.g. the route-level boundary in `apps/web/src/routes/Root.tsx`, whose
  fallback blanks unrelated UI), flag it and ask which boundary is intended.

## Query callback lifetimes

Query options can remain cached after their UI unmounts, including for disabled
queries. Callbacks created inside hooks can retain component accessors, Solid
owners, and detached DOM through shared closure environments—even when a callback
only references a locally resolved ID. This does not mean every closure captures
every local variable.

- Create cached callbacks in module-scope query factories accepting resolved IDs,
  flags, and plain data. Resolve reactive inputs inside the `useQuery` /
  `useInfiniteQuery` options accessor, e.g. `useQuery(() => itemQueryOptions(id()))`,
  so inputs still update reactively.
- Keep pure selectors and polling policies at module scope, or inside those
  factories. Check **all** retained callbacks: `queryFn`, `select`,
  `refetchInterval`, pagination, placeholder callbacks, and functions in `meta`.
- Do not pass component accessors, props getters, or query proxies into the
  factory. For reactive selection, pass plain snapshots of the needed values
  (such as channel names or a resolved document ID). Naming a function or copying
  an ID inside the hook does not isolate its closure from the hook.
- Use `keepPreviousData` from `@tanstack/solid-query` instead of an inline
  `placeholderData: (p) => p`.
- The same rule applies to callers of wrapper hooks such as `useSoupAstItemsQuery`
  and `createGroupedSoupQueries`: `meta.itemFilter` / `meta.insertFilter` passed
  from a component or view context are cached too, so build them with a
  module-scope factory over plain snapshots (see
  [drive-data-source](../../../apps/web/src/features/drive-view/queries/drive-data-source.ts)).
- Query hooks in `src/lib/urql-solid` are exempt: their observers are created per
  mount and destroyed on cleanup, so nothing outlives the component.

Examples: [session query factory](../../../apps/web/src/lib/queries/agent-session/session.ts) and
[search query factories](../../../apps/web/src/lib/queries/soup/search.ts).
