import { describe, expect, it } from 'vitest';
import type { NotificationInboxRow } from '../context/notifications-inbox-context';
import {
  itemIdsByRow,
  orderWorkFeedRows,
  type WorkFeedInboxEntry,
} from './work-feed-entries';

const row = (id: string, latestAt: number): NotificationInboxRow => ({
  id,
  type: 'channel_messages',
  revision: `rev-${id}`,
  latestAt,
  unseen: true,
  count: 1,
  content: { entity: {} as never, notifications: [] },
});

const entry = (
  itemId: string,
  sortAt: number,
  rows: NotificationInboxRow[]
): WorkFeedInboxEntry => ({ itemId, sortAt, rows });

const ids = (rows: NotificationInboxRow[]) => rows.map((r) => r.id);

describe('orderWorkFeedRows', () => {
  it('lists every row of the loaded items newest first', () => {
    const entries = [
      entry('channel:a', 50, [
        row('channel:a#channel_messages', 50),
        row('channel:a#channel_mention:m', 45),
      ]),
      entry('document:b', 48, [row('document:b#task', 48)]),
    ];
    expect(ids(orderWorkFeedRows(entries, true))).toEqual([
      'channel:a#channel_messages',
      'document:b#task',
      'channel:a#channel_mention:m',
    ]);
  });

  it('holds back rows an unloaded page could outrank until it loads', () => {
    const entries = [
      entry('channel:a', 50, [
        row('channel:a#channel_messages', 50),
        row('channel:a#channel_mention:m', 10),
      ]),
      entry('document:b', 30, [row('document:b#task', 30)]),
    ];
    // The next page holds items placed at or before 30, so the mention at
    // 10 may not be next yet.
    expect(ids(orderWorkFeedRows(entries, false))).toEqual([
      'channel:a#channel_messages',
      'document:b#task',
    ]);
    expect(ids(orderWorkFeedRows(entries, true))).toEqual([
      'channel:a#channel_messages',
      'document:b#task',
      'channel:a#channel_mention:m',
    ]);
  });

  it('shows nothing before the first page loads', () => {
    expect(orderWorkFeedRows([], false)).toEqual([]);
  });

  it('keeps rows at the same time in a stable order', () => {
    const entries = [
      entry('document:b', 20, [row('document:b#task', 20)]),
      entry('document:a', 20, [row('document:a#task', 20)]),
    ];
    expect(ids(orderWorkFeedRows(entries, true))).toEqual([
      'document:b#task',
      'document:a#task',
    ]);
  });
});

describe('itemIdsByRow', () => {
  it('maps each loaded row to the item that addresses its done', () => {
    const entries = [
      entry('channel:a', 50, [
        row('channel:a#channel_messages', 50),
        row('channel:a#channel_mention:m', 45),
      ]),
      entry('document:b', 48, [row('document:b#task', 48)]),
    ];
    expect([...itemIdsByRow(entries)]).toEqual([
      ['channel:a#channel_messages', 'channel:a'],
      ['channel:a#channel_mention:m', 'channel:a'],
      ['document:b#task', 'document:b'],
    ]);
  });
});
