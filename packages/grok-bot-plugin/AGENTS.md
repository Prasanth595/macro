# grok-bot-plugin

## What it is

AI: Macro packaged as a Grok Bot (Cursor Marketplace) plugin in the Agent
Plugins 1.0.0 format: `plugin.json`, `mcp.json` pointing at the public MCP
server, and skills.

## Start here

- `mcp.json`: the public MCP server URL (OAuth, no keys).
- `skills/*/SKILL.md`: what the Bot does with Macro; each ends with `RULES.md`.
- `SUBMISSION.md`: marketplace form text. Don't submit without the owner's say-so.

## Checks

- `scripts/validate.sh` (needs network for the schemas and `bunx ajv-cli`).

## Gotchas

- A skill may only name tools the public MCP server serves; rename them in the skills when a tool is renamed.
- `macro-report-back` posts with a user-owned bot token through
  `/messages/channel/{id}`; the channel webhook route can't post into threads.

## Related

- `services/bots/grok-bot-relay`, `services/agent_harness_service/src/public_mcp.rs`
