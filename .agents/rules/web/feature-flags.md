---
description: "New feature flags are on in dev, so a merged feature shows on dev.macro.com."
paths:
  - "apps/web/src/lib/core/constant/featureFlags.ts"
globs: "apps/web/src/lib/core/constant/featureFlags.ts"
alwaysApply: false
---

# Turn new flags on in dev

A flag that is off in dev hides a merged feature from everyone testing
dev.macro.com, and its author's local `VITE_*` override hides that from them.
Agent DMs merged this way, and no one on dev could see them.

- **FE-56** Default a new flag on in dev: `DEV_MODE_ENV` for an env-only flag,
  `onInDev` for a remote one. Choosing env-only over PostHog doesn't change
  this. To keep a flag off in dev, say why on the line above with
  `// ast-grep-ignore: ts-feature-flag-on-in-dev -- <why>`. Enforced by ast-grep
  `ts-feature-flag-on-in-dev` for a flag that is off in dev outright, CI error.
- Before merging, try the feature with the flag's default, not only with a
  local `VITE_*` override.

Check: `just check` reports no `ts-feature-flag-on-in-dev` finding, and each new
flag's `default` is `DEV_MODE_ENV` or `onInDev`.
