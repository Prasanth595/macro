import type { NotificationInboxRow } from '../context/notifications-inbox-context';
import { compareInboxRows } from '../core/inbox-row';

/**
 * One loaded work feed item and its inbox rows. The work feed pages by item
 * and addresses done through it; neither is part of the inbox contract.
 */
export type WorkFeedInboxEntry = {
  itemId: string;
  /** The item's place in the feed, epoch milliseconds. */
  sortAt: number;
  rows: NotificationInboxRow[];
};

/**
 * The rows of the loaded entries, newest first. The work feed pages by item,
 * and no row is newer than its item's place, so a row older than the last
 * loaded item could still be outranked by a row on a page not loaded yet:
 * those rows wait for the next page, unless the feed is exhausted.
 */
export function orderWorkFeedRows(
  entries: readonly WorkFeedInboxEntry[],
  exhausted: boolean
): NotificationInboxRow[] {
  const boundary = exhausted
    ? Number.NEGATIVE_INFINITY
    : (entries.at(-1)?.sortAt ?? Number.POSITIVE_INFINITY);
  return entries
    .flatMap((entry) => entry.rows)
    .filter((row) => row.latestAt >= boundary)
    .sort(compareInboxRows);
}

/** Which item each loaded row belongs to, for addressing a row done. */
export function itemIdsByRow(
  entries: readonly WorkFeedInboxEntry[]
): ReadonlyMap<string, string> {
  return new Map(
    entries.flatMap((entry) =>
      entry.rows.map((row) => [row.id, entry.itemId] as const)
    )
  );
}
