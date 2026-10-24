import { createFakeWorkFeedClient } from '@queries/work-feed/tests/fake-client';
import { createRoot } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InboxFeedSource } from '../context/notifications-inbox-context';
import { ALL_INBOX_ROW_TYPES } from '../core/inbox-filters';
import {
  inboxEntry,
  inboxPage,
  removedPatch,
  upsertedPatch,
} from '../tests/wire';
import { createWorkFeedInboxSource } from './work-feed-inbox-source';

// Row mapping imports allBlocks, which loads every block module; one of them
// opens a websocket that jsdom rejects after the test ends.
vi.mock('@core/constant/allBlocks', () => ({
  blockNameToDefaultFile: () => 'Untitled',
  itemToSafeName: (item: { name?: string }) => item.name ?? 'Untitled',
}));

const disposals: Array<() => void> = [];
afterEach(() => {
  for (const dispose of disposals.splice(0)) dispose();
  vi.useRealTimers();
});

/** Let timers at zero and the cache's promise chains run out. */
const flush = async () => {
  for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(0);
};

const WIRE_SCOPE = { mode: 'ATTENTION', includeSnippets: true, rowTypes: [] };

const docA = inboxEntry({
  docId: 'doc-a',
  sortAt: '2026-02-01T10:09:00Z',
  rows: [
    {
      id: 'document:doc-a#discussion_messages',
      latestAt: '2026-02-01T10:09:00Z',
    },
    {
      id: 'document:doc-a#task',
      rowType: 'TASK',
      latestAt: '2026-02-01T10:08:00Z',
    },
  ],
});
const docB = inboxEntry({
  docId: 'doc-b',
  sortAt: '2026-02-01T10:05:00Z',
  rows: [
    {
      id: 'document:doc-b#discussion_messages',
      latestAt: '2026-02-01T10:05:00Z',
    },
  ],
});
const docC = inboxEntry({
  docId: 'doc-c',
  sortAt: '2026-02-01T10:07:00Z',
  rows: [
    {
      id: 'document:doc-c#discussion_messages',
      latestAt: '2026-02-01T10:07:00Z',
    },
  ],
});

function setup(mutationData: Record<string, unknown> = {}) {
  const fake = createFakeWorkFeedClient(mutationData);
  const revalidateNotifications = vi.fn(async () => {});
  const restoreNotifications = vi.fn();
  const overrideNotificationsDone = vi.fn(() => restoreNotifications);
  let feed!: InboxFeedSource;
  const dispose = createRoot((rootDispose) => {
    feed = createWorkFeedInboxSource({
      client: () => fake.client,
      cacheHost: () => fake.host,
      scope: () => ({ rowTypes: ALL_INBOX_ROW_TYPES }),
      enabled: () => true,
      overrideNotificationsDone,
      revalidateNotifications,
    });
    return rootDispose;
  });
  disposals.push(dispose);
  const rowIds = () => feed.rows()?.map((row) => row.id);
  return {
    fake,
    feed,
    rowIds,
    overrideNotificationsDone,
    restoreNotifications,
  };
}

async function loaded(mutationData: Record<string, unknown> = {}) {
  const context = setup(mutationData);
  await flush();
  context.fake.queries[0].resolve(inboxPage([docA, docB]));
  await flush();
  return context;
}

describe('createWorkFeedInboxSource', () => {
  it('reads the attention feed and lists every row newest first', async () => {
    vi.useFakeTimers();
    const { fake, feed, rowIds } = setup();
    await flush();
    expect(feed.rows()).toBeUndefined();
    expect(fake.queries[0].variables).toEqual({
      input: { scope: WIRE_SCOPE, limit: 50, cursor: null },
    });
    expect(fake.subscriptions[0].variables).toEqual({ scope: WIRE_SCOPE });

    fake.queries[0].resolve(inboxPage([docA, docB]));
    await flush();

    expect(rowIds()).toEqual([
      'document:doc-a#discussion_messages',
      'document:doc-a#task',
      'document:doc-b#discussion_messages',
    ]);
  });

  it('writes live changes into the cached pages without a read', async () => {
    vi.useFakeTimers();
    const { fake, rowIds } = await loaded();
    const reads = fake.queries.length;

    fake.subscriptions[0].next({
      workFeedUpdates: [upsertedPatch(docC), removedPatch('document:doc-a')],
    });
    await flush();

    expect(fake.queries).toHaveLength(reads);
    expect(rowIds()).toEqual([
      'document:doc-c#discussion_messages',
      'document:doc-b#discussion_messages',
    ]);
  });

  it('marks one row done at its revision and hides only that row', async () => {
    vi.useFakeTimers();
    const { fake, feed, rowIds, overrideNotificationsDone } = await loaded({
      MarkWorkFeedItemsDone: {
        markWorkFeedItemsDone: { itemIds: [], undoToken: 'undo-1' },
      },
    });
    const task = feed.rows()?.find((row) => row.id === 'document:doc-a#task');
    if (!task) throw new Error('task row missing');

    await feed.markDone([task]);

    expect(fake.mutations[0].variables).toEqual({
      input: {
        items: [
          {
            id: 'document:doc-a',
            revision: 'rev-document:doc-a#task',
            rowId: 'document:doc-a#task',
          },
        ],
      },
    });
    expect(overrideNotificationsDone).toHaveBeenCalledWith([
      'n-document:doc-a#task',
    ]);
    expect(rowIds()).toEqual([
      'document:doc-a#discussion_messages',
      'document:doc-b#discussion_messages',
    ]);
  });

  it('shows the row again when the done fails', async () => {
    vi.useFakeTimers();
    const { feed, rowIds, restoreNotifications } = await loaded();
    const task = feed.rows()?.find((row) => row.id === 'document:doc-a#task');
    if (!task) throw new Error('task row missing');

    await expect(feed.markDone([task])).rejects.toThrow();

    expect(restoreNotifications).toHaveBeenCalled();
    expect(rowIds()).toContain('document:doc-a#task');
  });

  it('shows a done row again when a newer notification reopens it', async () => {
    vi.useFakeTimers();
    const { fake, feed, rowIds } = await loaded({
      MarkWorkFeedItemsDone: {
        markWorkFeedItemsDone: { itemIds: [], undoToken: 'undo-1' },
      },
    });
    const task = feed.rows()?.find((row) => row.id === 'document:doc-a#task');
    if (!task) throw new Error('task row missing');
    await feed.markDone([task]);

    const reopened = inboxEntry({
      docId: 'doc-a',
      sortAt: '2026-02-01T10:10:00Z',
      rows: [
        {
          id: 'document:doc-a#task',
          rowType: 'TASK',
          latestAt: '2026-02-01T10:10:00Z',
          revision: 'rev-newer',
        },
      ],
    });
    fake.subscriptions[0].next({ workFeedUpdates: [upsertedPatch(reopened)] });
    await flush();

    expect(rowIds()).toEqual([
      'document:doc-a#task',
      'document:doc-b#discussion_messages',
    ]);
  });

  it('undo restores the row in the place the server returns', async () => {
    vi.useFakeTimers();
    const { fake, feed, rowIds, restoreNotifications } = await loaded({
      MarkWorkFeedItemsDone: {
        markWorkFeedItemsDone: {
          itemIds: ['document:doc-b'],
          undoToken: 'undo-1',
        },
      },
      UndoNotificationInboxDone: {
        undoWorkFeedItemsDone: { patches: [upsertedPatch(docB)] },
      },
    });
    const row = feed
      .rows()
      ?.find(
        (candidate) => candidate.id === 'document:doc-b#discussion_messages'
      );
    if (!row) throw new Error('row missing');
    const done = await feed.markDone([row]);
    fake.subscriptions[0].next({
      workFeedUpdates: [removedPatch('document:doc-b')],
    });
    await flush();
    expect(rowIds()).not.toContain('document:doc-b#discussion_messages');

    await done.undo();
    await flush();

    expect(fake.mutations[1].variables).toEqual({
      input: { undoToken: 'undo-1', scope: WIRE_SCOPE },
    });
    expect(restoreNotifications).toHaveBeenCalled();
    expect(rowIds()).toContain('document:doc-b#discussion_messages');
  });
});
