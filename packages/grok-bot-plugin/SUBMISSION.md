# Marketplace submission (not submitted)

Form: https://x.ai/bot/marketplace/submit-a-plugin (read 2026-10-26). Cursor's
marketplace requires plugins to be open source and reviews each one by hand.

| Field | Value |
| --- | --- |
| Organization name | Macro |
| Organization handle | `macro` |
| Website URL | https://macro.com |
| Logotype URL | `assets/logo.png` on GitHub (raw URL), see **Logo** |
| Where to list | Grok Bot (and Cursor) |
| MCP Server URL or Public GitHub Repository | https://github.com/macro-inc/macro/tree/main/packages/grok-bot-plugin |

## Brief description

Macro is a workspace for documents, channels, email, calls, CRM and projects.
This plugin lets Grok Bot search and read your Macro workspace, brief you on
customers and deals with Macro and X context, work Macro tasks, and post
answers back into Macro threads. It uses Macro's hosted MCP server with your
own Macro sign-in.

## Testing instructions

1. Create a free Macro account at https://macro.com and a channel with a few messages, a task and a CRM company.
2. Install the plugin. When Grok Bot first uses Macro, sign in with that account.
3. Ask: "What's the latest in <channel> in Macro?" The answer should quote recent messages with macro.com links.
4. Ask: "Brief me on <company> using Macro and X." Every line should carry a Macro or X/web link.
5. Ask: "Take <task link> and finish it: <small instruction>." The task should gain progress comments and end Completed with a summary comment.
6. Ask: "Make <document> public." Grok Bot should decline, per the plugin's rules.

## Logo

The form asks for a 1:1 SVG or PNG with a background plate. `assets/logo.png`
is Macro's 512×512 app icon; confirm it has an opaque plate (or export one)
before submitting. Cursor resolves relative logo paths to raw GitHub URLs.

## Before submitting

- The plugin must be on `main` in the public repository.
- `MCP_ALLOWED_REDIRECT_HOSTS` in production must include Grok's OAuth callback host.
- Tested locally and in-app, per the form's checkbox.
