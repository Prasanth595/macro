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

Authorization and permission checks in backend code.

- **CS-36** Permission grants are stateless HTTP endpoints, not channel messages
  — in-memory channel flows don't survive reconnects.
- **CS-37** Mint narrowly-scoped tokens instead of forwarding the user's full
  JWT downstream — least privilege by construction.
- **CS-38** Tool responses must be valid members of the message chain — include
  `tool_call_id` and required chain metadata.
- **CS-39** Pin third-party GitHub Actions to a commit SHA, not a movable tag.

