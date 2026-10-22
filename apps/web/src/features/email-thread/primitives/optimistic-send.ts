import { fireAndForget } from '@core/util/fireAndForget';
import { createEffect, createMemo } from 'solid-js';
import type {
  EmailComposeContext,
  OutgoingEmail,
} from '../../email-compose/context/compose-capabilities';
import type { EmailMessage } from '../../email-message/core/email-message';
import type { EmailThreadSource } from '../context/email-thread-context';
import type { EmailThread } from '../core/email-thread';

type PendingSend = { send: OutgoingEmail; shownAt: string };

/** Show approved sends as sent in this surface until the thread read catches up. */
export function createOptimisticThreadSend(
  source: EmailThreadSource,
  compose: Pick<EmailComposeContext, 'delivery' | 'accounts' | 'viewerEmail'>
): EmailThreadSource {
  const tracked = createMemo(
    (previous: { pending: PendingSend[]; confirmed: Set<string> }) => {
      const messages = source.thread()?.messages ?? [];
      const live = compose.delivery.outgoing?.() ?? [];
      const confirmed = new Set(previous.confirmed);
      const pending: PendingSend[] = [];
      for (const send of [
        ...live,
        // A delivered send leaves the outbox before this read may show it.
        ...previous.pending
          .map((entry) => entry.send)
          .filter(
            (send) =>
              send.delivered &&
              !live.some((row) => row.sendAttemptId === send.sendAttemptId)
          ),
      ]) {
        if (confirmed.has(send.sendAttemptId)) continue;
        if (
          messages.some(
            (message) =>
              !message.is_draft && send.messageIds.includes(message.db_id)
          )
        ) {
          // Once the read shows it, a later deletion must not resurrect it.
          confirmed.add(send.sendAttemptId);
          continue;
        }
        pending.push({
          send,
          shownAt:
            previous.pending.find(
              (entry) => entry.send.sendAttemptId === send.sendAttemptId
            )?.shownAt ?? new Date().toISOString(),
        });
      }
      return { pending, confirmed };
    },
    { pending: [], confirmed: new Set<string>() }
  );

  // Delivery is when the server's copy stops being a draft; read it once.
  const refreshed = new Set<string>();
  createEffect(() => {
    const id = source.id();
    for (const { send } of tracked().pending) {
      if (
        !send.delivered ||
        !send.threadIds.includes(id) ||
        refreshed.has(send.sendAttemptId)
      )
        continue;
      refreshed.add(send.sendAttemptId);
      fireAndForget(source.refresh(), 'email-thread-send');
    }
  });

  function sentMessage(current: EmailThread, entry: PendingSend): EmailMessage {
    const { send, shownAt } = entry;
    const existing = current.messages.find((message) =>
      send.messageIds.includes(message.db_id)
    );
    const inbox = compose.accounts
      .inboxes()
      .find((inbox) => inbox.id === send.inboxId);
    return {
      ...existing,
      ...send.message,
      db_id: existing?.db_id ?? send.messageIds[0],
      thread_db_id: current.db_id,
      link_id: inbox?.id ?? current.link_id,
      from: inbox
        ? {
            email: inbox.email_address,
            name: inbox.displayName,
            photo_url: inbox.photo_url,
          }
        : (existing?.from ?? { email: compose.viewerEmail() ?? '' }),
      body_replyless: null,
      is_draft: false,
      is_read: existing?.is_read ?? true,
      scheduled_send_time: null,
      scheduled_send_status: null,
      created_at: existing?.created_at ?? shownAt,
      updated_at: shownAt,
      internal_date_ts: shownAt,
      sent_at: shownAt,
      attachments: existing?.attachments ?? [],
      attachments_draft: existing?.attachments_draft ?? [],
      attachments_forwarded: existing?.attachments_forwarded ?? [],
      labels:
        existing?.labels.filter(
          (label) => label.provider_label_id !== 'DRAFT'
        ) ?? [],
    };
  }

  const thread = () => {
    const current = source.thread();
    if (!current) return;
    const sends = tracked().pending.filter(
      ({ send }) =>
        send.threadIds.includes(current.db_id) ||
        current.messages.some((message) =>
          send.messageIds.includes(message.db_id)
        )
    );
    if (!sends.length) return current;
    const ids = new Set(sends.flatMap(({ send }) => send.messageIds));
    return {
      ...current,
      messages: [
        ...current.messages.filter((message) => !ids.has(message.db_id)),
        ...sends.map((entry) => sentMessage(current, entry)),
      ],
    };
  };

  return { ...source, thread };
}
