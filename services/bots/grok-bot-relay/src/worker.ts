import {
  type Env as MacroEnv,
  WEB_APP_URLS,
} from '../../../../packages/sdk/src/config';
import { createThreadPoster, type ThreadPoster } from './macro';
import {
  grokRequestFor,
  isRetryable,
  type MacroEnvelope,
  type RelayConfig,
  VALIDATION_EVENT,
  verifyDelivery,
} from './relay';

/** The part of a Workers KV namespace the relay uses. */
export type SeenEvents = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options: { expirationTtl: number }
  ): Promise<void>;
};

/** The part of the Workers execution context the relay uses. */
export type WaitUntil = { waitUntil(promise: Promise<unknown>): void };

export type WorkerEnv = {
  MACRO_ENV: string;
  MACRO_STORAGE_URL?: string;
  MACRO_WEB_URL?: string;
  MACRO_WEBHOOK_SECRET: string;
  MACRO_BOT_TOKEN: string;
  MACRO_BOT_ID: string;
  MACRO_BOT_OWNER_ID: string;
  /** Comma-separated ids of channels where every post is a request: the owner's private channel with the bot. */
  MACRO_DM_CHANNEL_IDS?: string;
  GROK_ROUTINE_URL: string;
  GROK_ROUTINE_KEY: string;
  SEEN_EVENTS: SeenEvents;
};

const REQUIRED_BINDINGS: readonly (keyof WorkerEnv)[] = [
  'MACRO_ENV',
  'MACRO_WEBHOOK_SECRET',
  'MACRO_BOT_TOKEN',
  'MACRO_BOT_ID',
  'MACRO_BOT_OWNER_ID',
  'GROK_ROUTINE_URL',
  'GROK_ROUTINE_KEY',
  'SEEN_EVENTS',
];

const MACRO_ENVIRONMENTS: readonly MacroEnv[] = ['dev', 'prod', 'local'];

/** Long enough to outlast Macro's retry schedule (about eight minutes). */
const SEEN_EVENT_TTL_SECONDS = 24 * 60 * 60;

const ACKNOWLEDGEMENT = 'On it, working in Grok Bot.';

/** Seams the tests replace; production uses the real clock, fetch and SDK. */
export type Dependencies = {
  now: () => number;
  fetch: (input: string, init: RequestInit) => Promise<Response>;
  threadPoster: (env: WorkerEnv, macroEnv: MacroEnv) => ThreadPoster;
};

const production: Dependencies = {
  now: () => Math.floor(Date.now() / 1000),
  fetch: (input, init) => fetch(input, init),
  threadPoster: (env, macroEnv) =>
    createThreadPoster({
      botToken: env.MACRO_BOT_TOKEN,
      ownerId: env.MACRO_BOT_OWNER_ID,
      env: macroEnv,
      storageUrl: env.MACRO_STORAGE_URL,
    }),
};

function relayConfig(env: WorkerEnv, macroEnv: MacroEnv): RelayConfig {
  return {
    botId: env.MACRO_BOT_ID,
    dmChannelIds: new Set(
      (env.MACRO_DM_CHANNEL_IDS ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    ),
    webAppUrl: (env.MACRO_WEB_URL ?? WEB_APP_URLS[macroEnv]).replace(/\/$/, ''),
  };
}

export async function handle(
  request: Request,
  env: WorkerEnv,
  ctx: WaitUntil,
  deps: Dependencies
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/health') {
    return Response.json({ ok: true });
  }
  if (request.method !== 'POST' || url.pathname !== '/webhook') {
    return new Response('Not found', { status: 404 });
  }

  const missing = REQUIRED_BINDINGS.filter((key) => !env[key]);
  if (missing.length > 0) {
    return Response.json(
      { error: `missing worker bindings: ${missing.join(', ')}` },
      { status: 500 }
    );
  }
  const macroEnv = MACRO_ENVIRONMENTS.find((name) => name === env.MACRO_ENV);
  if (!macroEnv) {
    return Response.json(
      { error: `MACRO_ENV must be one of: ${MACRO_ENVIRONMENTS.join(', ')}` },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  const verdict = await verifyDelivery(
    env.MACRO_WEBHOOK_SECRET,
    {
      rawBody,
      timestamp: request.headers.get('x-macro-timestamp'),
      signature: request.headers.get('x-macro-signature'),
    },
    deps.now()
  );
  if (verdict !== 'ok') {
    console.warn('Rejected Macro delivery', { verdict });
    return new Response('Invalid signature', { status: 401 });
  }
  if (request.headers.get('x-macro-event') === VALIDATION_EVENT) {
    return Response.json({ ok: true });
  }

  let envelope: MacroEnvelope;
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const grok = grokRequestFor(envelope, relayConfig(env, macroEnv));
  if (!grok) return Response.json({ ok: true, ignored: true });

  const log = {
    eventId: grok.event_id,
    event: grok.event,
    channelId: grok.channel_id,
    messageId: grok.message_id,
  };
  if ((await env.SEEN_EVENTS.get(grok.event_id)) !== null) {
    console.log('Skipped a redelivered Macro event', log);
    return Response.json({ ok: true, duplicate: true });
  }

  const post = deps.threadPoster(env, macroEnv);
  const started = await deps.fetch(env.GROK_ROUTINE_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GROK_ROUTINE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(grok),
  });
  if (!started.ok) {
    console.error('Grok Bot routine did not start', {
      ...log,
      status: started.status,
    });
    if (isRetryable(started.status)) {
      return new Response('Grok Bot unavailable', { status: 502 });
    }
    // A bad key or a paused routine won't fix itself on redelivery.
    await env.SEEN_EVENTS.put(grok.event_id, 'failed', {
      expirationTtl: SEEN_EVENT_TTL_SECONDS,
    });
    ctx.waitUntil(
      post(
        grok.channel_id,
        grok.thread_id,
        `Couldn't start Grok Bot (HTTP ${started.status}). Check the routine's webhook trigger.`
      ).catch((error) =>
        console.error('Failed to post to Macro', { ...log, error })
      )
    );
    return Response.json({ ok: true, started: false });
  }

  await env.SEEN_EVENTS.put(grok.event_id, 'started', {
    expirationTtl: SEEN_EVENT_TTL_SECONDS,
  });
  ctx.waitUntil(
    post(grok.channel_id, grok.thread_id, ACKNOWLEDGEMENT).catch((error) =>
      console.error('Failed to acknowledge in Macro', { ...log, error })
    )
  );
  console.log('Started Grok Bot run', log);
  return Response.json({ ok: true, started: true });
}

export default {
  fetch(request: Request, env: WorkerEnv, ctx: WaitUntil) {
    return handle(request, env, ctx, production);
  },
};
