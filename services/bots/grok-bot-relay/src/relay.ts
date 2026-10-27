import type {
  MessageMentionedMetadata,
  MessagePostedMetadata,
} from '../../../../packages/sdk/generated/storage/types.gen';
import { verifySignature } from '../../../../packages/sdk/src/events/verify';

/** Deliveries signed longer ago than this are refused as replays. */
const MAX_SIGNATURE_AGE_SECONDS = 300;

/** Macro's ping when a webhook is registered or re-validated. */
export const VALIDATION_EVENT = 'webhook.validation.test';

/** One signed Macro webhook delivery, as received. */
export type Delivery = {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
};

export type Verdict = 'ok' | 'bad-signature' | 'stale';

/** Check a delivery's `X-Macro-Signature` and that it was signed recently. */
export async function verifyDelivery(
  secret: string,
  delivery: Delivery,
  nowSeconds: number
): Promise<Verdict> {
  if (!delivery.timestamp || !delivery.signature) return 'bad-signature';
  const signed = await verifySignature({
    secret,
    timestamp: delivery.timestamp,
    rawBody: delivery.rawBody,
    signature: delivery.signature,
  });
  if (!signed) return 'bad-signature';
  const signedAt = Number(delivery.timestamp);
  if (
    !Number.isInteger(signedAt) ||
    Math.abs(nowSeconds - signedAt) > MAX_SIGNATURE_AGE_SECONDS
  ) {
    return 'stale';
  }
  return 'ok';
}

/** The Macro events this relay forwards; anything else is acknowledged and dropped. */
export type MacroEnvelope =
  | {
      event_id: string;
      event_type: 'message.mentioned';
      metadata: MessageMentionedMetadata;
    }
  | {
      event_id: string;
      event_type: 'message.posted';
      metadata: MessagePostedMetadata;
    }
  | { event_id: string; event_type: string; metadata: unknown };

/** Which bot this relay speaks for, and where it can be reached. */
export type RelayConfig = {
  /** The user-owned Macro bot's id (no `bot|` prefix). */
  botId: string;
  /** Direct-message channels between the owner and the bot. */
  dmChannelIds: ReadonlySet<string>;
  /** Macro web app origin, for links. */
  webAppUrl: string;
};

/** The JSON body sent to the Grok Bot routine's webhook trigger. */
export type GrokRequest = {
  event: 'message.mentioned' | 'message.posted';
  event_id: string;
  channel_id: string;
  /** The thread to reply in: the root message's id. */
  thread_id: string;
  message_id: string;
  /** The Macro message body (Macro Markdown). */
  text: string;
  /** The author's principal id (`macro|…` or `bot|…`). */
  sender: string;
  links: { message: string; channel: string };
};

function botPrincipal(config: RelayConfig): string {
  return `bot|${config.botId}`.toLowerCase();
}

function isBot(principal: string, config: RelayConfig): boolean {
  return principal.toLowerCase() === botPrincipal(config);
}

function request(
  event: GrokRequest['event'],
  eventId: string,
  metadata: MessageMentionedMetadata | MessagePostedMetadata,
  channelId: string,
  config: RelayConfig
): GrokRequest {
  const channel = `${config.webAppUrl}/app/channel/${channelId}`;
  return {
    event,
    event_id: eventId,
    channel_id: channelId,
    thread_id: metadata.root_id,
    message_id: metadata.message_id,
    text: metadata.content,
    sender: metadata.sender,
    links: {
      message: `${channel}?channel_message_id=${metadata.message_id}`,
      channel,
    },
  };
}

/**
 * The Grok Bot request for a delivery, or `undefined` when the relay ignores
 * it: the bot's own messages, mentions of anyone else, posts outside the
 * bot's private channels, and private-channel posts that also @-mention the
 * bot (the mention event covers those, so one message starts one run).
 */
export function grokRequestFor(
  envelope: MacroEnvelope,
  config: RelayConfig
): GrokRequest | undefined {
  if (envelope.event_type === 'message.mentioned') {
    const metadata = envelope.metadata as MessageMentionedMetadata;
    if (metadata.parent.type !== 'channel') return undefined;
    if (!isBot(metadata.mentioned.entity_id, config)) return undefined;
    if (isBot(metadata.sender, config)) return undefined;
    return request(
      'message.mentioned',
      envelope.event_id,
      metadata,
      metadata.parent.id,
      config
    );
  }
  if (envelope.event_type === 'message.posted') {
    const metadata = envelope.metadata as MessagePostedMetadata;
    if (metadata.parent.type !== 'channel') return undefined;
    if (!config.dmChannelIds.has(metadata.parent.id)) return undefined;
    if (isBot(metadata.sender, config)) return undefined;
    if (metadata.mentions.some((mention) => isBot(mention.entity_id, config))) {
      return undefined;
    }
    return request(
      'message.posted',
      envelope.event_id,
      metadata,
      metadata.parent.id,
      config
    );
  }
  return undefined;
}

/** Whether Macro should redeliver after the Grok Bot webhook answered `status`. */
export function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}
