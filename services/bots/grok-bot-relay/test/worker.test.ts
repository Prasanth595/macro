import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import {
  type Dependencies,
  handle,
  type SeenEvents,
  type WorkerEnv,
} from '../src/worker';

const SECRET = 'whsec_test_secret';
const BOT_ID = '0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee';
const OWNER = 'macro|owner@example.com';
const CHANNEL = '0199cccc-0000-7000-8000-000000000001';
const DM = '0199cccc-0000-7000-8000-000000000002';
const ROOT = '0199dddd-0000-7000-8000-000000000001';
const MESSAGE = '0199dddd-0000-7000-8000-000000000002';
const NOW = 1_800_000_000;
const SECRET_TEXT = 'quarterly numbers are confidential';

class MemoryKv implements SeenEvents {
  readonly values = new Map<string, string>();
  async get(key: string) {
    return this.values.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.values.set(key, value);
  }
}

type Harness = {
  env: WorkerEnv;
  kv: MemoryKv;
  grokCalls: { url: string; init: RequestInit }[];
  posts: { channelId: string; threadId: string; content: string }[];
  pending: Promise<unknown>[];
  deps: Dependencies;
};

function harness(grokStatus = 200): Harness {
  const kv = new MemoryKv();
  const grokCalls: Harness['grokCalls'] = [];
  const posts: Harness['posts'] = [];
  const pending: Promise<unknown>[] = [];
  return {
    kv,
    grokCalls,
    posts,
    pending,
    env: {
      MACRO_ENV: 'prod',
      MACRO_WEBHOOK_SECRET: SECRET,
      MACRO_BOT_TOKEN: 'mbot_test',
      MACRO_BOT_ID: BOT_ID,
      MACRO_BOT_OWNER_ID: OWNER,
      MACRO_DM_CHANNEL_IDS: DM,
      GROK_ROUTINE_URL: 'https://grok.example/routines/hook',
      GROK_ROUTINE_KEY: 'routine-key',
      SEEN_EVENTS: kv,
    },
    deps: {
      now: () => NOW,
      fetch: async (input, init) => {
        grokCalls.push({ url: String(input), init: init ?? {} });
        return new Response(null, { status: grokStatus });
      },
      threadPoster: () => async (channelId, threadId, content) => {
        posts.push({ channelId, threadId, content });
      },
    },
  };
}

async function sign(timestamp: number, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`${timestamp}.${body}`)
  );
  return `v1=${new Uint8Array(digest).toHex()}`;
}

async function deliver(
  h: Harness,
  envelope: unknown,
  options: { timestamp?: number; signature?: string; event?: string } = {}
): Promise<Response> {
  const body = JSON.stringify(envelope);
  const timestamp = options.timestamp ?? NOW;
  const response = await handle(
    new Request('https://relay.example/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-macro-event':
          options.event ?? (envelope as { event_type: string }).event_type,
        'x-macro-timestamp': String(timestamp),
        'x-macro-signature': options.signature ?? (await sign(timestamp, body)),
      },
      body,
    }),
    h.env,
    { waitUntil: (promise) => h.pending.push(promise) },
    h.deps
  );
  await Promise.all(h.pending);
  return response;
}

function mention(overrides: Record<string, unknown> = {}) {
  return {
    event_id: 'evt-mention-1',
    schema_version: 1,
    event_type: 'message.mentioned',
    metadata: {
      parent: { type: 'channel', id: CHANNEL },
      message_id: MESSAGE,
      thread_id: ROOT,
      root_id: ROOT,
      sender: OWNER,
      content: SECRET_TEXT,
      mentioned: { entity_type: 'bot', entity_id: `bot|${BOT_ID}` },
      created_at: '2026-10-26T12:00:00Z',
      ...overrides,
    },
  };
}

function dmPost(overrides: Record<string, unknown> = {}) {
  return {
    event_id: 'evt-dm-1',
    schema_version: 1,
    event_type: 'message.posted',
    metadata: {
      parent: { type: 'channel', id: DM },
      message_id: MESSAGE,
      thread_id: null,
      root_id: MESSAGE,
      sender: OWNER,
      triggered_by: null,
      content: SECRET_TEXT,
      mentions: [],
      attachments: [],
      created_at: '2026-10-26T12:00:00Z',
      ...overrides,
    },
  };
}

let logged: unknown[][] = [];
const spies: ReturnType<typeof spyOn>[] = [];
beforeEach(() => {
  logged = [];
  for (const method of ['log', 'warn', 'error'] as const) {
    spies.push(
      spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      })
    );
  }
});
afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore();
  // Message text never reaches logs.
  expect(JSON.stringify(logged)).not.toContain(SECRET_TEXT);
});

describe('signature checks', () => {
  test('a forged signature is rejected before anything is forwarded', async () => {
    const h = harness();
    const response = await deliver(h, mention(), { signature: 'v1=deadbeef' });
    expect(response.status).toBe(401);
    expect(h.grokCalls).toHaveLength(0);
    expect(h.posts).toHaveLength(0);
  });

  test('a correctly signed but stale delivery is rejected as a replay', async () => {
    const h = harness();
    const response = await deliver(h, mention(), { timestamp: NOW - 301 });
    expect(response.status).toBe(401);
    expect(h.grokCalls).toHaveLength(0);
  });

  test('the validation ping is acknowledged and not forwarded', async () => {
    const h = harness();
    const response = await deliver(
      h,
      {
        event_id: 'evt-validate',
        event_type: 'webhook.validation.test',
        metadata: {},
      },
      { event: 'webhook.validation.test' }
    );
    expect(response.status).toBe(200);
    expect(h.grokCalls).toHaveLength(0);
  });
});

describe('forwarding', () => {
  test('a mention of the bot starts a Grok Bot run and acknowledges in the thread', async () => {
    const h = harness();
    const response = await deliver(h, mention());

    expect(response.status).toBe(200);
    expect(h.grokCalls).toHaveLength(1);
    const [call] = h.grokCalls;
    expect(call.url).toBe('https://grok.example/routines/hook');
    expect((call.init.headers as Record<string, string>).authorization).toBe(
      'Bearer routine-key'
    );
    expect(JSON.parse(String(call.init.body))).toEqual({
      event: 'message.mentioned',
      event_id: 'evt-mention-1',
      channel_id: CHANNEL,
      thread_id: ROOT,
      message_id: MESSAGE,
      text: SECRET_TEXT,
      sender: OWNER,
      links: {
        message: `https://macro.com/app/channel/${CHANNEL}?channel_message_id=${MESSAGE}`,
        channel: `https://macro.com/app/channel/${CHANNEL}`,
      },
    });
    expect(h.posts).toEqual([
      {
        channelId: CHANNEL,
        threadId: ROOT,
        content: 'On it, working in Grok Bot.',
      },
    ]);
  });

  test('mentions of someone else, and the bot mentioning itself, are ignored', async () => {
    const h = harness();
    await deliver(
      h,
      mention({
        mentioned: {
          entity_type: 'user',
          entity_id: 'macro|someone@example.com',
        },
      })
    );
    await deliver(h, mention({ sender: `bot|${BOT_ID}` }));
    expect(h.grokCalls).toHaveLength(0);
    expect(h.posts).toHaveLength(0);
  });

  test('a DM to the bot is forwarded; the bot’s own DM replies are not', async () => {
    const h = harness();
    await deliver(h, dmPost());
    expect(h.grokCalls).toHaveLength(1);
    expect(JSON.parse(String(h.grokCalls[0].init.body)).event).toBe(
      'message.posted'
    );

    await deliver(h, dmPost({ sender: `bot|${BOT_ID}` }));
    expect(h.grokCalls).toHaveLength(1);
  });

  test('posts in other channels are not forwarded', async () => {
    const h = harness();
    await deliver(h, dmPost({ parent: { type: 'channel', id: CHANNEL } }));
    expect(h.grokCalls).toHaveLength(0);
  });

  test('a DM that also @-mentions the bot starts one run, from the mention', async () => {
    const h = harness();
    await deliver(
      h,
      dmPost({ mentions: [{ entity_type: 'bot', entity_id: `bot|${BOT_ID}` }] })
    );
    expect(h.grokCalls).toHaveLength(0);
  });
});

describe('redelivery', () => {
  test('a redelivered event does not start a second run', async () => {
    const h = harness();
    await deliver(h, mention());
    await deliver(h, mention(), { timestamp: NOW });
    expect(h.grokCalls).toHaveLength(1);
    expect(h.posts).toHaveLength(1);
  });

  test('a busy Grok Bot asks Macro to retry and remembers nothing', async () => {
    const h = harness(429);
    const response = await deliver(h, mention());
    expect(response.status).toBe(502);
    expect(h.kv.values.size).toBe(0);
    expect(h.posts).toHaveLength(0);
  });

  test('a rejected routine call is reported once in the thread', async () => {
    const h = harness(401);
    const response = await deliver(h, mention());
    expect(response.status).toBe(200);
    expect(h.posts).toHaveLength(1);
    expect(h.posts[0].content).toContain('HTTP 401');

    await deliver(h, mention());
    expect(h.grokCalls).toHaveLength(1);
    expect(h.posts).toHaveLength(1);
  });
});
