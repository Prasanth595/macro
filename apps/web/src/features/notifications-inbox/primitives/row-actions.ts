import { createSignal } from 'solid-js';
import { match } from 'ts-pattern';
import type {
  InboxRowAction,
  InboxRowActions,
  InboxRowChoice,
  NotificationInboxRow,
} from '../context/notifications-inbox-context';

/** What the row's newest notification asks the viewer to decide, if anything. */
export function rowAction(
  row: NotificationInboxRow
): InboxRowAction | undefined {
  const latest = row.content.notifications[0];
  if (!latest) return undefined;
  return match(latest.notification_metadata)
    .returnType<InboxRowAction | undefined>()
    .with({ tag: 'entity_access_requested' }, (metadata) =>
      row.type === 'access_requested'
        ? {
            kind: 'access_request',
            entityType: latest.entity_type,
            entityId: latest.entity_id,
            requestId: metadata.content.requestId,
            revision: metadata.content.revision,
            level: metadata.content.accessLevel,
          }
        : undefined
    )
    .with({ tag: 'calendar_event_join_request' }, (metadata) =>
      row.type === 'calendar_join_request'
        ? {
            kind: 'join_request',
            requestId: metadata.content.requestId,
            eventId: metadata.content.eventId,
          }
        : undefined
    )
    .otherwise(() => undefined);
}

/** The answers an action offers, the affirmative first. */
export const actionChoices = (action: InboxRowAction): InboxRowChoice[] =>
  match(action)
    .with({ kind: 'access_request' }, () => ['approve', 'deny'] as const)
    .with({ kind: 'join_request' }, () => ['accept', 'decline'] as const)
    .exhaustive()
    .slice();

export type InboxRowActionNotices = {
  succeeded: (choice: InboxRowChoice) => void;
  failed: (choice: InboxRowChoice) => void;
};

/**
 * Runs row answers: one at a time per row, then completes the row, which the
 * answer resolved. A failed answer leaves the row as it was.
 */
export function createRowActions(options: {
  actions: InboxRowActions;
  complete: (row: NotificationInboxRow) => Promise<unknown>;
  notices: InboxRowActionNotices;
}) {
  const [pending, setPending] = createSignal<
    ReadonlyMap<string, InboxRowChoice>
  >(new Map());
  const setRowPending = (rowId: string, choice: InboxRowChoice | undefined) =>
    setPending((current) => {
      const next = new Map(current);
      if (choice) next.set(rowId, choice);
      else next.delete(rowId);
      return next;
    });

  const answer = (action: InboxRowAction, choice: InboxRowChoice) =>
    match(action)
      .with({ kind: 'access_request' }, (request) =>
        options.actions.resolveAccessRequest(request, choice === 'approve')
      )
      .with({ kind: 'join_request' }, (request) =>
        options.actions.answerJoinRequest(request, choice === 'accept')
      )
      .exhaustive();

  const run = async (row: NotificationInboxRow, choice: InboxRowChoice) => {
    const action = rowAction(row);
    if (!action || pending().has(row.id)) return;
    setRowPending(row.id, choice);
    try {
      await answer(action, choice);
    } catch {
      options.notices.failed(choice);
      setRowPending(row.id, undefined);
      return;
    }
    options.notices.succeeded(choice);
    try {
      await options.complete(row);
    } catch {
      // The answer stands; the row leaves when the server's change lands.
    }
    setRowPending(row.id, undefined);
  };

  return {
    /** The answer in flight for a row, if any. */
    pending: (rowId: string) => pending().get(rowId),
    run,
  };
}
