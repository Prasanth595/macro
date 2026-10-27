import type {
  MessageListItem,
  MessageTimelinePage,
} from '@service-storage/messages';

export const VIEWER_ID = 'macro|viewer@example.com';

const SENDERS = [
  VIEWER_ID,
  'macro|ada@example.com',
  'macro|grace@example.com',
  'macro|linus@example.com',
];

const BODIES = [
  'Sounds good, shipping it after lunch.',
  'Can someone take a look at the deploy logs? The worker restarted twice overnight and I am not sure whether it is the new queue consumer or the memory limit we lowered last week.',
  'Notes from the sync:\n\n- Calendar import is behind a flag until Thursday\n- Email search ranking needs another pass\n- We owe design the empty states for Tasks',
  "Here is the query I used:\n\n```sql\nselect channel_id, count(*)\nfrom messages\nwhere created_at > now() - interval '1 day'\ngroup by 1\norder by 2 desc\nlimit 20;\n```",
  'Agreed. **Let us keep the old endpoint** until the mobile release is out, then remove it in one change with the migration.',
  'Quick one: does anyone know why the preview bucket is still public?',
  'I wrote up the plan in the doc. The short version is that we move the parser into the worker, cache the parsed tree per version, and stop re-parsing on every keystroke. That should take the editor from roughly 40ms per input to under 5ms on the large fixtures.',
  'lgtm 👍',
  '> The import fails when the file has a BOM\n\nFixed in the latest build, can you retry?',
  'Reminder that the offsite agenda is due Friday. Please add your topics, even rough ones, so we can group them before the planning call.',
];

const REPLY_BODIES = [
  'On it.',
  'Thanks, that fixed it for me.',
  'I think we should wait for the numbers before deciding.',
];

function timestamp(minute: number): string {
  return new Date(
    Date.UTC(2026, 9, 20, 9, 0, 0) + minute * 60_000
  ).toISOString();
}

function message(
  channelId: string,
  index: number,
  fields: Partial<MessageListItem> = {}
): MessageListItem {
  const id = `${channelId}-message-${String(index).padStart(3, '0')}`;
  const created = timestamp(index * 7);
  return {
    id,
    parent: { type: 'channel', id: channelId },
    sender_id: SENDERS[index % SENDERS.length]!,
    content: BODIES[index % BODIES.length]!,
    created_at: created,
    updated_at: created,
    attachments: [],
    mentions: [],
    reactions:
      index % 4 === 0
        ? [
            { emoji: '👍', users: [SENDERS[1]!, SENDERS[2]!] },
            { emoji: '🎉', users: [SENDERS[3]!] },
          ]
        : [],
    state: {
      root_id: id,
      created_at: created,
      updated_at: created,
      resolved: false,
      user_id: SENDERS[index % SENDERS.length]!,
    },
    thread: { preview: [], reply_count: 0 },
    ...fields,
  };
}

function withReplies(root: MessageListItem, count: number): MessageListItem {
  const replies = Array.from({ length: Math.min(count, 2) }, (_, index) => ({
    ...message(root.parent.id, 0),
    id: `${root.id}-reply-${index}`,
    thread_id: root.id,
    content: REPLY_BODIES[index % REPLY_BODIES.length]!,
    sender_id: SENDERS[(index + 1) % SENDERS.length]!,
    created_at: new Date(
      Date.parse(root.created_at) + (index + 1) * 60_000
    ).toISOString(),
    reactions: [],
  }));
  return {
    ...root,
    thread: {
      preview: replies,
      reply_count: count,
      latest_reply_at: replies.at(-1)?.created_at,
    },
  };
}

/** The newest page of a channel, newest first like the server sends it. */
export function channelTimeline(
  channelId: string,
  count = 50
): MessageTimelinePage {
  const messages = Array.from({ length: count }, (_, index) => {
    const root = message(
      channelId,
      index,
      index === count - 1 ? { content: newestMessageText(channelId) } : {}
    );
    return index % 6 === 3 ? withReplies(root, 2 + (index % 3)) : root;
  });
  return {
    entries: messages
      .reverse()
      .map((item) => ({ type: 'message' as const, message: item })),
    next_cursor: null,
    previous_cursor: null,
  };
}

/** The newest message's text, unique per channel. */
export function newestMessageText(channelId: string): string {
  return `Latest update in ${channelId}: the release notes are ready for review.`;
}
