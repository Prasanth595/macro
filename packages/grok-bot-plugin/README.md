# Macro for Grok Bot

Connects Grok Bot to your [Macro](https://macro.com) workspace: documents,
channels, email, calls, CRM, projects and tasks.

## What's inside

- `mcp.json`: Macro's MCP server (`https://mcp-server.macro.com/mcp`), with
  the same tools as any other MCP client. You sign in to Macro the first time
  Grok Bot uses it; there are no keys to configure.
- Skills:
  - `macro-brief`: brief on a company, person or deal from Macro plus X and the web, citing every line.
  - `macro-take-task`: work a Macro task, commenting progress and closing it with a summary.
  - `macro-report-back`: reply in the Macro thread a request came from (see `services/bots/grok-bot-relay`).

## Try it

- "Brief me on Acme using Macro and X."
- "Take https://macro.com/app/task/… and finish it."

## Install for testing

Grok Bot installs plugins from the marketplace. Before listing, add the MCP
server directly: in the Grok Bot app, add a custom MCP server, choose
**Remote HTTPS**, and enter the URL above. To use the skills, ask the Bot to
save each `SKILL.md` as a skill, or install the plugin locally in Cursor by
copying this folder to `~/.cursor/plugins/local/macro`.

## License

AGPL-3.0, like the rest of this repository.
