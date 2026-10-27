import type { Env } from '../../../../packages/sdk/src/config';
import { Thread } from '../../../../packages/sdk/src/entities/channels/thread';
import { Macro } from '../../../../packages/sdk/src/macro';

export type ThreadPosterConfig = {
  /** The user-owned bot's token (`mbot_…`). */
  botToken: string;
  /** The bot's owner (`macro|…`); a user-owned bot can act only as its owner. */
  ownerId: string;
  env: Env;
  /** Optional storage API base URL for a custom Macro deployment. */
  storageUrl?: string;
};

/** Posts a reply, as the bot, in a channel thread. */
export type ThreadPoster = (
  channelId: string,
  threadId: string,
  content: string
) => Promise<void>;

/**
 * Reply as the bot with its owner's access (`x-macro-bot-scope: user`). The
 * channel webhook can't post into threads, so this uses the message API the
 * SDK picks for a bot acting as a user.
 */
export function createThreadPoster(config: ThreadPosterConfig): ThreadPoster {
  const macro = new Macro({
    env: config.env,
    auth: { type: 'bot', token: config.botToken, scope: 'user' },
    requestedAs: config.ownerId,
    hosts: config.storageUrl ? { storage: config.storageUrl } : undefined,
  });
  return async (channelId, threadId, content) => {
    await new Thread(macro._client, channelId, threadId).reply(content);
  };
}
