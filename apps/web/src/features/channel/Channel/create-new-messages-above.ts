import {
  type InsertedThreadReply,
  onThreadReplyInserted,
} from '@queries/messages/reconcile';
import { type Accessor, createMemo, createSignal, onCleanup } from 'solid-js';
import type { UnreadDestinationElements } from './create-unread-destination-registry';
import {
  insertedReplyPositions,
  newMessagesAboveChip,
} from './new-messages-above';
import type { ThreadListScrollState } from './ThreadList';
import { unreadDestinationPositions } from './unread-thread-navigation';

/**
 * Replies, sent or received, that join a thread above the viewport. Each one
 * counts until it has been on screen once.
 */
export function createNewMessagesAbove(options: {
  channelId: string;
  /** Loaded thread roots; their previews hold every inserted reply. */
  messages: Accessor<
    readonly { id: string; thread: { preview: readonly { id: string }[] } }[]
  >;
  keys: Accessor<readonly string[]>;
  scrollState: Accessor<ThreadListScrollState | undefined>;
  container: Accessor<HTMLElement | undefined>;
  insets: Accessor<{ start: number; end: number }>;
  elements: UnreadDestinationElements;
}) {
  const [inserted, setInserted] = createSignal<InsertedThreadReply[]>([]);
  onCleanup(
    onThreadReplyInserted((parent, reply) => {
      if (parent.type !== 'channel' || parent.id !== options.channelId) return;
      setInserted((previous) =>
        previous.some((item) => item.messageId === reply.messageId)
          ? previous
          : [...previous, reply]
      );
    })
  );

  // A failed send rolls back, and a deleted reply leaves the preview.
  const present = createMemo(() => {
    const previews = new Map(
      options.messages().map((message) => [message.id, message.thread.preview])
    );
    return inserted().filter((reply) =>
      previews.get(reply.threadId)?.some((item) => item.id === reply.messageId)
    );
  });

  const positions = createMemo(() => {
    const replies = present();
    const scroll = options.scrollState();
    if (!scroll?.didInitialScroll || replies.length === 0) return new Map();
    const viewport = options
      .container()
      ?.querySelector('[data-channel-scroll]');
    const destinations = viewport
      ? unreadDestinationPositions(
          replies.map((reply) => ({
            threadId: reply.threadId,
            messageIds: [reply.messageId],
          })),
          options.elements,
          viewport,
          options.insets()
        )
      : new Map();
    return insertedReplyPositions(
      replies,
      options.keys(),
      scroll.visibleRange,
      destinations
    );
  });

  return {
    chip: createMemo(() => newMessagesAboveChip(present(), positions())),
    /** Call after each scroll publish, so a seen reply stays dismissed. */
    dismissSeen: () => {
      const current = positions();
      const remaining = inserted().filter(
        (reply) => current.get(reply.messageId) !== 'visible'
      );
      if (remaining.length !== inserted().length) setInserted(remaining);
    },
  };
}
