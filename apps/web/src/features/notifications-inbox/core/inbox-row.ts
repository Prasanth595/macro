/** The kinds of notification inbox row. */
export type InboxRowType =
  | 'ai_suggestion'
  | 'agent'
  | 'email'
  | 'channel_mention'
  | 'channel_messages'
  | 'channel_thread'
  | 'discussion_mention'
  | 'discussion_messages'
  | 'discussion_thread'
  | 'task'
  | 'pull_request'
  | 'calendar_event'
  | 'calendar_join_request'
  | 'access_requested'
  | 'access_granted';

/**
 * One notification inbox row: the notifications that present together, such
 * as one thread or one access request. `Content` is what the row shows; the
 * data source's adapter decides its shape.
 */
export type InboxRow<Content> = {
  /** Stable, opaque row id. */
  id: string;
  type: InboxRowType;
  /** What a done of this row acknowledges. */
  revision: string;
  /** When the row's newest notification was created, epoch milliseconds. */
  latestAt: number;
  unseen: boolean;
  /** How many notifications the row shows. */
  count: number;
  content: Content;
};

/** Newest first; equal times keep a stable order by row id. */
export function compareInboxRows<Content>(
  a: InboxRow<Content>,
  b: InboxRow<Content>
): number {
  if (a.latestAt !== b.latestAt) return b.latestAt - a.latestAt;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * Rows the viewer marked done, with the revision each acknowledged. They stay
 * hidden while a loaded row still shows that revision, until the live change
 * that removes them lands; a newer notification shows them again.
 */
export type InboxDone = ReadonlyMap<string, string>;

/** The rows without the ones hidden as done. */
export function withoutDoneRows<Content>(
  rows: readonly InboxRow<Content>[],
  done: InboxDone
): InboxRow<Content>[] {
  return rows.filter((row) => done.get(row.id) !== row.revision);
}

/** Hide rows as done at the revision each acknowledged. */
export function markRowsDone(
  done: InboxDone,
  rows: readonly Pick<InboxRow<unknown>, 'id' | 'revision'>[]
): InboxDone {
  const next = new Map(done);
  for (const row of rows) next.set(row.id, row.revision);
  return next;
}

/** Show rows again after an undone or failed done. */
export function unmarkRowsDone(
  done: InboxDone,
  rowIds: readonly string[]
): InboxDone {
  const next = new Map(done);
  for (const rowId of rowIds) next.delete(rowId);
  return next;
}

/**
 * Forget done rows a fresh read settled: the feed no longer holds them, or
 * holds them with newer notifications. Only rows still shown at the
 * acknowledged revision stay hidden.
 */
export function settleRowsDone<Content>(
  done: InboxDone,
  rows: readonly InboxRow<Content>[]
): InboxDone {
  if (done.size === 0) return done;
  const next = new Map<string, string>();
  for (const row of rows) {
    if (done.get(row.id) === row.revision) next.set(row.id, row.revision);
  }
  return next;
}
