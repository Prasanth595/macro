import { createUrqlInfiniteQuery } from '@app/lib/urql-solid/create-urql-infinite-query';
import { fireAndForget } from '@core/util/fireAndForget';
import type { CacheHost } from '@graphql-cache/host/types';
import { createLiveWorkFeed } from '@queries/work-feed/live-work-feed';
import {
  markWorkFeedItemsDone,
  undoWorkFeedItemsDone,
} from '@queries/work-feed/work-feed-mutations';
import {
  NotificationInboxDocument,
  type NotificationInboxPatchFieldsFragment,
  type NotificationInboxQuery,
  type NotificationInboxQueryVariables,
  NotificationInboxUpdatesDocument,
  UndoNotificationInboxDoneDocument,
  type WorkFeedScopeInput,
} from '@service-storage/graphql/generated/graphql';
import { type Client, stringifyDocument } from '@urql/core';
import { type Accessor, createMemo, createSignal } from 'solid-js';
import type {
  InboxFeedSource,
  InboxScope,
  NotificationInboxRow,
} from '../context/notifications-inbox-context';
import {
  type InboxDone,
  markRowsDone,
  settleRowsDone,
  unmarkRowsDone,
  withoutDoneRows,
} from '../core/inbox-row';
import { encodeInboxScope, toInboxEntry } from './decode';
import {
  itemIdsByRow,
  orderWorkFeedRows,
  type WorkFeedInboxEntry,
} from './work-feed-entries';

/** Items fetched per inbox page. */
export const INBOX_PAGE_LIMIT = 50;

const inboxCachedQuery = {
  query: stringifyDocument(NotificationInboxDocument),
  operationName: 'NotificationInbox',
};

const isEntry = (
  entry: WorkFeedInboxEntry | null
): entry is WorkFeedInboxEntry => entry !== null;

/** The variables of the inbox page that starts at `cursor`. */
export const inboxPageVariables = (
  scope: WorkFeedScopeInput,
  cursor: string | null
): NotificationInboxQueryVariables => ({
  input: { scope, limit: INBOX_PAGE_LIMIT, cursor },
});

export type WorkFeedInboxSourceOptions = {
  client: Accessor<Client>;
  /** The normalized cache holding the feed's pages, when it is available. */
  cacheHost: Accessor<Pick<CacheHost, 'readQuery' | 'writeQuery'> | undefined>;
  scope: Accessor<InboxScope>;
  enabled: Accessor<boolean>;
  /** Subscribes to transport reconnects, after which changes may be missed. */
  onReconnected?: (listener: () => void) => () => void;
  /**
   * Shows the done to other readers of these notifications at once, until
   * the server's change reaches them; returns the reversal.
   */
  overrideNotificationsDone?: (ids: readonly string[]) => () => void;
  /** Reconciles other notification readers after a done or undo commits. */
  revalidateNotifications?: (client: Client) => Promise<void>;
};

/**
 * The inbox read from the server work feed: its attention feed's notification
 * inbox rows, kept current by its live stream. Done completes single rows,
 * hiding them until the server's change removes them. Everything specific to
 * the work feed (item paging, item-addressed done) stays in this adapter.
 */
export function createWorkFeedInboxSource(
  options: WorkFeedInboxSourceOptions
): InboxFeedSource {
  const scopeInput = createMemo(() => encodeInboxScope(options.scope()));

  const query = createUrqlInfiniteQuery<
    NotificationInboxQuery,
    NotificationInboxQueryVariables,
    string | null,
    { entries: WorkFeedInboxEntry[]; cursors: (string | null)[] }
  >(() => {
    const scope = scopeInput();
    return {
      query: NotificationInboxDocument,
      client: options.client(),
      initialPageParam: null,
      variables: (cursor) => inboxPageVariables(scope, cursor),
      getNextPageParam: (lastPage) =>
        lastPage.user.workFeed.nextCursor ?? undefined,
      enabled: options.enabled(),
      requestPolicy: 'cache-and-network',
      keepPreviousData: true,
      select: ({ pages, pageParams }) => ({
        entries: pages
          .flatMap((page) => page.user.workFeed.entries)
          .map(toInboxEntry)
          .filter(isEntry),
        cursors: [...pageParams],
      }),
    };
  });

  const [done, setDone] = createSignal<InboxDone>(new Map());
  const ordered = createMemo(() =>
    orderWorkFeedRows(query.data?.entries ?? [], !query.hasNextPage)
  );
  const itemIds = createMemo(() => itemIdsByRow(query.data?.entries ?? []));

  const live = createLiveWorkFeed({
    client: options.client,
    cacheHost: options.cacheHost,
    enabled: options.enabled,
    query,
    pages: {
      cachedQuery: inboxCachedQuery,
      variables: (cursor) => inboxPageVariables(scopeInput(), cursor),
    },
    updates: {
      document: NotificationInboxUpdatesDocument,
      variables: () => ({ scope: scopeInput() }),
    },
    onReconnected: options.onReconnected,
    // A done row that left the feed and returns with the revision it
    // acknowledged was reopened, so it shows again; while it is still
    // loaded, the same revision is a change computed before the done.
    onPatches: (patches) => {
      const present = new Set(ordered().map((row) => row.id));
      const reopened = patches.flatMap((patch) =>
        patch.__typename === 'WorkFeedEntryUpserted'
          ? patch.entry.rows.flatMap((row) => {
              const acknowledged = done().get(row.id);
              return acknowledged !== undefined &&
                (acknowledged !== row.revision || !present.has(row.id))
                ? [row.id]
                : [];
            })
          : []
      );
      if (reopened.length > 0) {
        setDone((current) => unmarkRowsDone(current, reopened));
      }
    },
    onRefetched: () => setDone((current) => settleRowsDone(current, ordered())),
    surface: 'notifications-inbox',
  });

  const rows = createMemo(() =>
    query.data === undefined ? undefined : withoutDoneRows(ordered(), done())
  );

  const markDone = async (targets: readonly NotificationInboxRow[]) => {
    const client = options.client();
    const scope = scopeInput();
    const ids = targets.map((row) => row.id);
    const items = targets.flatMap((row) => {
      const itemId = itemIds().get(row.id);
      return itemId ? [{ itemId, revision: row.revision, rowId: row.id }] : [];
    });
    setDone((current) => markRowsDone(current, targets));
    const restoreNotifications = options.overrideNotificationsDone?.(
      targets.flatMap((row) =>
        row.content.notifications.map((notification) => notification.id)
      )
    );
    let undoToken: string;
    try {
      ({ undoToken } = await markWorkFeedItemsDone(client, items));
    } catch (error) {
      restoreNotifications?.();
      setDone((current) => unmarkRowsDone(current, ids));
      throw error;
    }
    fireAndForget(
      options.revalidateNotifications?.(client),
      'notifications-inbox'
    );
    return {
      undo: async () => {
        const patches: NotificationInboxPatchFieldsFragment[] =
          await undoWorkFeedItemsDone(
            client,
            UndoNotificationInboxDoneDocument,
            { undoToken, scope }
          );
        restoreNotifications?.();
        setDone((current) => unmarkRowsDone(current, ids));
        fireAndForget(
          options.revalidateNotifications?.(client),
          'notifications-inbox'
        );
        // The restored places land now rather than with the stream.
        live.applyPatches(patches);
      },
    };
  };

  return {
    rows,
    isLoading: () => options.enabled() && query.isLoading && !query.data,
    error: () => query.error ?? undefined,
    hasMore: () => options.enabled() && query.hasNextPage && !query.error,
    isLoadingMore: () => query.isFetchingNextPage,
    loadMore: async () => {
      if (!query.hasNextPage || query.isFetchingNextPage) return;
      await query.fetchNextPage();
    },
    refresh: live.refetch,
    markDone,
  };
}
