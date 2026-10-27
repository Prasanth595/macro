# grok-bot-relay

## What it is

Bots: a Cloudflare Worker that forwards Macro mentions of one
user-owned bot, and posts in its private channel with the owner, to a Grok
Bot routine webhook, and acknowledges in the thread.
The Grok Bot replies itself, through the `macro-report-back` skill in
`packages/grok-bot-plugin`.

## Start here

- `src/relay.ts`: signature and freshness check, which events are relayed, the
  request body sent to Grok Bot.
- `src/worker.ts`: the HTTP handler: verify, dedupe by event id in KV, call the
  routine, acknowledge.
- `src/macro.ts`: threaded reply as the bot acting as its owner.
- `scripts/setup.ts`: creates the bot, token, private channel, channel access and webhook
  with the owner's API key.

## Checks

- `bun test`
- `bunx tsc --noEmit --project tsconfig.json`

## Gotchas

- Use a user-owned bot with `x-macro-bot-scope: user`; a team-owned bot can act
  as any team member.
- `POST /channels/{id}/webhook` cannot post into threads; replies go through
  `/messages/channel/{id}` with an acting user (the SDK's `requestedAs`).
- Each relayed event is a paid Grok Bot run: keep the KV dedupe and the
  one-run-per-message filtering (a private-channel post that also @-mentions the bot is relayed
  once, from the mention).
- Never log message text or secrets.

## Related

- Docs: `README.md`, `crates/webhook/README.md`, `packages/sdk/README.md`
