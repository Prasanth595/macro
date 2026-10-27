# grok-bot-plugin

## What it is

AI: Macro as a Grok Bot (Cursor Marketplace) plugin in the Agent Plugins 1.0.0
format. Contents and install steps: `README.md`.

## Gotchas

- Skills may only name tools the public MCP server serves; update them when a tool is renamed.
- Every skill ends with the same "Rules for every Macro skill" section. Change it in all three at once.
- `macro-report-back` posts with a user-owned bot token through
  `/messages/channel/{id}`; the channel webhook route can't post into threads.
- Don't submit to the marketplace without the owner's say-so.

## Related

- `services/bots/grok-bot-relay`, `services/agent_harness_service/src/public_mcp.rs`
