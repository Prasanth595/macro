---
description: "Keep the web startup bundle small: views, blocks, and modals load lazily."
paths:
  - "apps/web/src/**"
  - "apps/web/index.html"
globs: "apps/web/src/**,apps/web/index.html"
alwaysApply: false
---

# Startup bundle

- Everything statically reachable from `src/index.tsx` downloads and runs before the first screen. Views, block components, and modals load through `lazy()` / `lazyNamed` (`@core/util/lazyNamed`) inside a `<Suspense>`; never statically import one into a shared hub (`Root`, `Layout`, `componentRegistry`, `app-router-view`, block `definition.ts`, Lexical `init.ts`).
- `index.html` draws a boot shell (rail, view sidebar, Home's composer) before any JS runs, from the saved theme and the `rememberBootShell` layout hint; `Root` hands off once auth is known. Keep its geometry in step with `SidebarRail`, `ViewSidebar`, and `HomeChatStart`.
- Production web builds register `public/sw.js`: it serves the cached `index.html` and content-hashed assets from Cache Storage and moves tabs to newer builds. Set localStorage `macro:sw` to `off` to bypass it while debugging.
- The build fails if any emitted file exceeds CloudFront's 10 MB compression limit; split it rather than raising the limit.
