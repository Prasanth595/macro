import { describe, expect, it, vi } from 'vitest';
import { inboxEntry } from '../tests/wire';
import { encodeInboxScope, toInboxEntry } from './decode';

// Row mapping imports allBlocks, which loads every block module; one of them
// opens a websocket that jsdom rejects after the test ends.
vi.mock('@core/constant/allBlocks', () => ({
  blockNameToDefaultFile: () => 'Untitled',
  itemToSafeName: (item: { name?: string }) => item.name ?? 'Untitled',
}));

describe('toInboxEntry', () => {
  it('turns each row into an inbox row whose entity carries only its notifications', () => {
    const entry = toInboxEntry(
      inboxEntry({
        docId: 'doc-a',
        sortAt: '2026-02-01T10:09:00Z',
        rows: [
          {
            id: 'document:doc-a#discussion_mention:t1',
            rowType: 'DISCUSSION_MENTION',
            latestAt: '2026-02-01T10:09:00Z',
            notificationIds: ['n-1', 'n-2'],
          },
          {
            id: 'document:doc-a#task',
            rowType: 'TASK',
            latestAt: '2026-02-01T10:01:00Z',
            unseen: false,
          },
        ],
      })
    );

    expect(entry?.itemId).toBe('document:doc-a');
    expect(entry?.sortAt).toBe(Date.parse('2026-02-01T10:09:00Z'));
    expect(
      entry?.rows.map((row) => ({
        id: row.id,
        type: row.type,
        unseen: row.unseen,
        count: row.count,
        notifications: row.content.notifications.map((n) => n.id),
        entityNotifications: (
          row.content.entity.notifications as { id: string }[]
        ).map((n) => n.id),
      }))
    ).toEqual([
      {
        id: 'document:doc-a#discussion_mention:t1',
        type: 'discussion_mention',
        unseen: true,
        count: 2,
        notifications: ['n-1', 'n-2'],
        entityNotifications: ['n-1', 'n-2'],
      },
      {
        id: 'document:doc-a#task',
        type: 'task',
        unseen: false,
        count: 1,
        notifications: ['n-document:doc-a#task'],
        entityNotifications: ['n-document:doc-a#task'],
      },
    ]);
  });

  it('drops an entry without a valid place', () => {
    expect(
      toInboxEntry(inboxEntry({ docId: 'doc-a', sortAt: 'never', rows: [] }))
    ).toBeNull();
  });
});

describe('encodeInboxScope', () => {
  it('reads the attention feed, narrowed to the chosen rows', () => {
    expect(encodeInboxScope({ rowTypes: ['email', 'channel_thread'] })).toEqual(
      {
        mode: 'ATTENTION',
        includeSnippets: true,
        rowTypes: ['EMAIL', 'CHANNEL_THREAD'],
      }
    );
  });
});
