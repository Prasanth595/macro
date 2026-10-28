import type { InsertedThreadReply } from '@queries/messages/reconcile';
import type {
  UnreadDestinationPosition,
  VisibleThreadRange,
} from './unread-thread-navigation';

export type NewMessagesAboveChip = {
  /** The earliest inserted reply still above the viewport. */
  target: InsertedThreadReply;
  count: number;
};

/**
 * A mounted reply, or the collapsed disclosure hiding it, is measured. An
 * unmounted thread is placed by its row against the visible range; a thread
 * inside the range is still laying out and has no position yet.
 */
export function insertedReplyPositions(
  replies: readonly InsertedThreadReply[],
  keys: readonly string[],
  visible: VisibleThreadRange | undefined,
  destinations: ReadonlyMap<string, UnreadDestinationPosition>
): ReadonlyMap<string, UnreadDestinationPosition> {
  const positions = new Map<string, UnreadDestinationPosition>();
  const first = visible ? keys.indexOf(visible.first) : -1;
  const last = visible ? keys.indexOf(visible.last) : -1;
  for (const reply of replies) {
    const measured = destinations.get(reply.messageId);
    if (measured) {
      positions.set(reply.messageId, measured);
      continue;
    }
    const index = keys.indexOf(reply.threadId);
    if (index < 0 || first < 0 || last < 0) continue;
    if (index < first) positions.set(reply.messageId, 'above');
    else if (index > last) positions.set(reply.messageId, 'below');
  }
  return positions;
}

export function newMessagesAboveChip(
  replies: readonly InsertedThreadReply[],
  positions: ReadonlyMap<string, UnreadDestinationPosition>
): NewMessagesAboveChip | undefined {
  const above = replies.filter(
    (reply) => positions.get(reply.messageId) === 'above'
  );
  const target = above[0];
  if (target) return { target, count: above.length };
}
