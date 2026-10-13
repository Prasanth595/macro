---
description: "Authorization and permission checks in backend code."
paths:
  - "crates/**/*.rs"
  - "services/**/*.rs"
  - "tooling/**/*.rs"
globs: "crates/**/*.rs,services/**/*.rs,tooling/**/*.rs"
alwaysApply: false
---

# Rust security and permissions

Authorization and permission checks in backend code. IDs are stable; cite them in reviews.

- **CS-36** `[sec]` Permission grants are stateless HTTP endpoints, not channel
  messages — in-memory channel flows don't survive reconnects. (#4201, #4296)
- **CS-37** `[sec]` Mint narrowly-scoped tokens instead of forwarding the user's full
  JWT downstream — least privilege by construction. (#4296)
- **CS-38** `[sec]` Tool responses must be valid members of the message chain — include
  `tool_call_id` and required chain metadata. (#4296)
- **CS-39** `[sec]` Pin third-party GitHub Actions to a commit SHA, not a movable tag.
  (#4276)
