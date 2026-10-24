import type { UnifiedNotification } from '@notifications/types';
import type { NotificationInboxRow } from '../context/notifications-inbox-context';

type NotificationState = (
  notification: UnifiedNotification
) => UnifiedNotification['state'];

/**
 * Whether a row reads as unread. The server decides from the row's
 * notifications; opening the row here marks them seen locally, which reads
 * as read before the server's change lands. Email follows its mailbox's read
 * state, which only the server knows.
 */
export function isRowUnseen(
  row: NotificationInboxRow,
  state: NotificationState
): boolean {
  if (row.type === 'email') return row.unseen;
  return (
    row.unseen &&
    row.content.notifications.some(
      (notification) => state(notification) === 'unseen'
    )
  );
}

/** The row's notifications that are still unseen, to mark seen on open. */
export function unseenNotifications(
  row: NotificationInboxRow,
  state: NotificationState
): UnifiedNotification[] {
  return row.content.notifications.filter(
    (notification) => state(notification) === 'unseen'
  );
}
