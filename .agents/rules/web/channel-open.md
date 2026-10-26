---
description: "Opening a channel stays within its request and forced-layout budget."
paths:
  - "apps/web/src/features/channel/**"
  - "apps/web/src/features/channels-view/**"
  - "apps/web/src/lib/core/component/LexicalMarkdown/**"
  - "apps/web/src/lib/core/component/CustomScrollbar.tsx"
globs: "apps/web/src/features/channel/**,apps/web/src/features/channels-view/**,apps/web/src/lib/core/component/LexicalMarkdown/**,apps/web/src/lib/core/component/CustomScrollbar.tsx"
alwaysApply: false
---

# Keep work off the channel-open path

Opening a channel is the app's most frequent navigation. Work added to every
message row or every composer runs on each open before the first message
paints; a per-row DOM read and a closed menu's fetches each cost a release
hundreds of milliseconds.

- **FE-69** Code that mounts with each message row, the composer, or its menus
  does no work its first paint doesn't need: fetch when the user asks (a menu
  opens, a hover, a scroll), not on mount; batch DOM reads before writes, as
  `ThreadList` measures rows; read layout in `ResizeObserver` callbacks, never
  from mutation observers or per-row effects.
- **FE-70** `just test-channel-browser` (CI's Channel Open Browser Budget) pins
  the requests and script-forced layouts of a channel switch. Update its
  `EXPECTED_REQUESTS` or `FORCED_LAYOUT_BUDGET` only in the change that needs
  it, and say why in the description.
- Opening a channel reports a `channel.open` span
  (`features/channel/observability.ts`). After changing this path, compare
  `channel.open.*` in a DevTools recording before and after, and check
  `web.channel.open.painted` in Datadog once it ships.

Check: `just test-channel-browser` passes from `apps/web` without a budget or
allowlist change, or the change explains it.
