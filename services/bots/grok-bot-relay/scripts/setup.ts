/**
 * Sets up the Macro side of the Grok Bot relay with your own API key:
 *
 *   bun run setup             create the bot, its token, its private channel,
 *                             channel access and the webhook; write every value
 *                             to .dev.vars
 *   bun run setup validate    ask Macro to ping the running relay
 *
 * Inputs (environment or .env next to this package, never committed):
 *   MACRO_API_KEY      your Macro API key (Settings → API Keys)
 *   MACRO_ENV          prod | dev | local (default prod)
 *   MACRO_STORAGE_URL  optional storage API override, e.g. a tunnel to a local stack
 *   GROK_BOT_NAME      the bot's display name, e.g. "Grok (Alex)"
 *   GROK_BOT_HANDLE    the bot's handle, e.g. "grok-alex"
 *   MACRO_CHANNEL_ID   the test channel to add the bot to
 *   RELAY_URL          the relay's public origin (wrangler or tunnel URL)
 *
 * Secrets are written to .dev.vars (gitignored) and never printed.
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Env, HOSTS } from '../../../../packages/sdk/src/config';
import type { Webhook } from '../../../../packages/sdk/src/entities/webhooks/webhook';
import { Macro } from '../../../../packages/sdk/src/macro';

const PACKAGE_DIR = join(import.meta.dir, '..');
const DEV_VARS = join(PACKAGE_DIR, '.dev.vars');
const WEBHOOK_NAMESPACE = 'grok-bot-relay';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function macroEnv(): Env {
  const value = process.env.MACRO_ENV ?? 'prod';
  if (value !== 'prod' && value !== 'dev' && value !== 'local') {
    throw new Error('MACRO_ENV must be prod, dev or local');
  }
  return value;
}

function readDevVars(): Map<string, string> {
  const vars = new Map<string, string>();
  if (!existsSync(DEV_VARS)) return vars;
  for (const line of readFileSync(DEV_VARS, 'utf8').split('\n')) {
    const at = line.indexOf('=');
    if (at > 0 && !line.startsWith('#'))
      vars.set(line.slice(0, at), line.slice(at + 1));
  }
  return vars;
}

function writeDevVars(vars: Map<string, string>) {
  const body = [...vars].map(([key, value]) => `${key}=${value}`).join('\n');
  writeFileSync(DEV_VARS, `${body}\n`, { mode: 0o600 });
  chmodSync(DEV_VARS, 0o600);
}

/** Calls a storage route the SDK doesn't wrap, as the API key's user. */
async function storage<T>(
  path: string,
  init: { method: string; body?: unknown }
): Promise<T> {
  const base = process.env.MACRO_STORAGE_URL ?? HOSTS[macroEnv()].storage;
  const response = await fetch(`${base}${path}`, {
    method: init.method,
    headers: {
      'x-macro-user-api-key': required('MACRO_API_KEY'),
      'content-type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    throw new Error(
      `${init.method} ${path} failed: ${response.status} ${await response.text()}`
    );
  }
  return (await response.json()) as T;
}

type Bot = { id: string; handle: string; owner?: unknown };

function bareBotId(id: string): string {
  return id.replace(/^bot\|/, '');
}

async function setup() {
  const macro = new Macro({
    env: macroEnv(),
    auth: { type: 'user', apiKey: required('MACRO_API_KEY') },
    hosts: process.env.MACRO_STORAGE_URL
      ? { storage: process.env.MACRO_STORAGE_URL }
      : undefined,
  });
  const vars = readDevVars();
  const handle = required('GROK_BOT_HANDLE');

  // 1. A user-owned bot (no team_id), so it can only ever act as you.
  const bots = await storage<Bot[] | { bots: Bot[] }>('/bots', {
    method: 'GET',
  });
  const list = Array.isArray(bots) ? bots : bots.bots;
  let bot = list.find((candidate) => candidate.handle === handle);
  if (bot) {
    console.log(`Using existing bot @${handle}`);
  } else {
    bot = await storage<Bot>('/bots', {
      method: 'POST',
      body: {
        name: required('GROK_BOT_NAME'),
        handle,
        description:
          'Relays mentions and DMs to my Grok Bot and posts its answers.',
      },
    });
    console.log(`Created bot @${handle}`);
  }
  const botId = bareBotId(bot.id);

  // 2. A token for the relay and the Grok Bot.
  if (!vars.get('MACRO_BOT_TOKEN')) {
    const issued = await storage<{ bearer_token: string }>(
      `/bots/${botId}/tokens`,
      {
        method: 'POST',
        body: { label: 'grok-bot-relay' },
      }
    );
    vars.set('MACRO_BOT_TOKEN', issued.bearer_token);
    // Saved now: a token is shown once, and a later step can fail.
    writeDevVars(vars);
    console.log('Issued a bot token (saved to .dev.vars)');
  }

  // 3. The test channel, and a private channel with just you and the bot.
  // Macro only opens DMs with bots that run a Macro agent, so this private
  // channel stands in for the bot's DM.
  let dmChannelId = vars.get('MACRO_DM_CHANNEL_IDS');
  if (!dmChannelId) {
    const channel = await macro.channels.create({
      type: 'private',
      name: required('GROK_BOT_NAME'),
    });
    dmChannelId = channel.id;
    vars.set('MACRO_DM_CHANNEL_IDS', dmChannelId);
    writeDevVars(vars);
    console.log('Created a private channel for you and the bot');
  }
  for (const channelId of [required('MACRO_CHANNEL_ID'), dmChannelId]) {
    await storage(`/channels/${channelId}/bots`, {
      method: 'POST',
      body: { bot_id: botId },
    }).catch((error: Error) => {
      if (!error.message.includes('409')) throw error;
    });
  }
  const me = await macro.users.me();

  // 4. A personal webhook: mentions anywhere you can see, posts in the
  // private channel.
  const relayUrl = required('RELAY_URL').replace(/\/$/, '');
  let existing: Webhook | undefined;
  for (const webhook of await macro.webhooks.list()) {
    if ((await webhook.namespace()) === WEBHOOK_NAMESPACE) existing = webhook;
  }
  const filters = [
    { events: ['message.mentioned'] },
    { events: ['message.posted'], ids: [dmChannelId] },
  ];
  if (existing && vars.get('MACRO_WEBHOOK_SECRET')) {
    await existing.setUrl(`${relayUrl}/webhook`);
    await existing.setFilters(filters);
    console.log('Updated the existing webhook');
  } else {
    const webhook = await macro.webhooks.create({
      url: `${relayUrl}/webhook`,
      namespace: WEBHOOK_NAMESPACE,
      name: `Grok Bot relay (@${handle})`,
      filters,
      scope: 'user',
    });
    const secret = webhook.signingSecret;
    if (!secret)
      throw new Error('Macro did not return a webhook signing secret');
    vars.set('MACRO_WEBHOOK_SECRET', secret);
    vars.set('MACRO_WEBHOOK_ID', webhook.id);
    console.log('Created the webhook (signing secret saved to .dev.vars)');
  }

  vars.set('MACRO_ENV', macroEnv());
  if (process.env.MACRO_STORAGE_URL)
    vars.set('MACRO_STORAGE_URL', process.env.MACRO_STORAGE_URL);
  vars.set('MACRO_BOT_ID', botId);
  vars.set('MACRO_BOT_OWNER_ID', me.id);
  vars.set('GROK_ROUTINE_URL', vars.get('GROK_ROUTINE_URL') ?? '');
  vars.set('GROK_ROUTINE_KEY', vars.get('GROK_ROUTINE_KEY') ?? '');
  writeDevVars(vars);
  console.log(
    'Wrote .dev.vars. Add GROK_ROUTINE_URL and GROK_ROUTINE_KEY, start the relay, then run `bun run setup validate`.'
  );
}

async function validate() {
  const macro = new Macro({
    env: macroEnv(),
    auth: { type: 'user', apiKey: required('MACRO_API_KEY') },
    hosts: process.env.MACRO_STORAGE_URL
      ? { storage: process.env.MACRO_STORAGE_URL }
      : undefined,
  });
  const id = readDevVars().get('MACRO_WEBHOOK_ID');
  if (!id) throw new Error('Run `bun run setup` first');
  const result = await macro.webhooks.byId(id).validate();
  console.log(JSON.stringify(result));
}

await (process.argv[2] === 'validate' ? validate() : setup());
