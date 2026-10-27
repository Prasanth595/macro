import { normalizedCacheExchange } from '@graphql-cache/exchange/normalized-cache-exchange';
import { createNoopCacheHost } from '@graphql-cache/host/noop-host';
import type { CacheHost } from '@graphql-cache/host/types';
import { Telemetry } from '@macro-inc/observability';
import {
  createClient,
  type Exchange,
  type OperationResult,
  subscriptionExchange,
} from '@urql/core';
import { afterEach, expect, it, vi } from 'vitest';
import {
  NotificationUpdatesDocument,
  type NotificationUpdatesSubscription,
} from './graphql/generated/graphql';
import { notificationReceiptExchange } from './graphql-notification-receipt';
import type { GraphqlNotificationPatch } from './graphql-soup-websocket';

const NEW_NOTIFICATION: GraphqlNotificationPatch = {
  __typename: 'GraphqlNewNotification',
  notification: {
    __typename: 'GraphqlNotification',
    id: 'notification-1',
    entityId: 'reminder-1',
    entityType: 'REMINDER',
    eventType: 'reminder',
    sent: true,
    state: 'UNSEEN',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    viewedAt: null,
    senderId: null,
    metadata: {
      __typename: 'GraphqlReminderMetadata',
      reminderReminderId: 'reminder-1',
      reminderDescription: 'Review the document',
      reminderScheduledFor: null,
    },
  },
};
const DELETION: GraphqlNotificationPatch = {
  __typename: 'GraphqlCacheDeletion',
  graphqlTypeName: 'GraphqlNotification',
  entityId: 'notification-1',
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function subscribe(
  exchanges: Exchange[],
  onResult: (result: OperationResult<NotificationUpdatesSubscription>) => void
) {
  let receive: (result: { data: NotificationUpdatesSubscription }) => void =
    () => {
      throw new Error('subscription is not attached');
    };
  const attached = Promise.withResolvers<void>();
  const unsubscribe = vi.fn();
  const client = createClient({
    url: 'https://notification.test/graphql',
    exchanges: [
      ...exchanges,
      subscriptionExchange({
        forwardSubscription: () => ({
          subscribe(sink) {
            receive = (result) => sink.next(result);
            attached.resolve();
            return { unsubscribe };
          },
        }),
      }),
    ],
  });
  const subscription = client
    .subscription(NotificationUpdatesDocument, {})
    .subscribe(onResult);
  return {
    attached: attached.promise,
    emit: (patch: GraphqlNotificationPatch) =>
      receive({ data: { notificationUpdates: patch } }),
    dispose: () => subscription.unsubscribe(),
    unsubscribe,
  };
}

it('delivers hidden-tab events before parked writes, preserving cache order without replaying alerts', async () => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const resume = Promise.withResolvers<void>();
  const writeStarted = Promise.withResolvers<void>();
  const caughtUp = Promise.withResolvers<void>();
  const noop = createNoopCacheHost();
  const host: CacheHost = {
    ...noop,
    disabled: false,
    writeQuery: vi.fn(async (args) => {
      writeStarted.resolve();
      await resume.promise;
      return await noop.writeQuery(args);
    }),
    deleteRecords: vi.fn(noop.deleteRecords),
  };
  const onPatch = vi.fn();
  const onResult = vi.fn(
    (result: OperationResult<NotificationUpdatesSubscription>) => {
      if (
        result.data?.notificationUpdates.__typename === 'GraphqlCacheDeletion'
      )
        caughtUp.resolve();
    }
  );
  const stream = subscribe(
    [normalizedCacheExchange(host), notificationReceiptExchange(onPatch)],
    onResult
  );
  try {
    await stream.attached;
    stream.emit(NEW_NOTIFICATION);
    await writeStarted.promise;
    stream.emit(DELETION);
    expect(onPatch.mock.calls).toEqual([[NEW_NOTIFICATION], [DELETION]]);
    expect(onResult).not.toHaveBeenCalled();
    expect(host.deleteRecords).not.toHaveBeenCalled();

    resume.resolve();
    await caughtUp.promise;
    expect(host.writeQuery).toHaveBeenCalledOnce();
    expect(host.deleteRecords).toHaveBeenCalledExactlyOnceWith([
      'GraphqlNotification:notification-1',
    ]);
    expect(onResult).toHaveBeenCalledTimes(2);
    expect(onPatch).toHaveBeenCalledTimes(2);
  } finally {
    stream.dispose();
    host.dispose();
  }
});

it('does not let a notification callback failure stop persistence or the next event', async () => {
  vi.useFakeTimers();
  const error = new Error('notification callback failed');
  const report = vi.spyOn(Telemetry, 'error').mockImplementation(() => {});
  const onPatch = vi.fn().mockImplementationOnce(() => {
    throw error;
  });
  const caughtUp = Promise.withResolvers<void>();
  const noop = createNoopCacheHost();
  const host: CacheHost = {
    ...noop,
    writeQuery: vi.fn(noop.writeQuery),
    deleteRecords: vi.fn(noop.deleteRecords),
  };
  const stream = subscribe(
    [normalizedCacheExchange(host), notificationReceiptExchange(onPatch)],
    (result) => {
      if (
        result.data?.notificationUpdates.__typename === 'GraphqlCacheDeletion'
      )
        caughtUp.resolve();
    }
  );
  try {
    await stream.attached;
    stream.emit(NEW_NOTIFICATION);
    stream.emit(DELETION);
    await caughtUp.promise;
    expect(report).toHaveBeenCalledWith(error, {
      surface: 'graphql-notifications',
    });
    expect(onPatch).toHaveBeenCalledTimes(2);
    expect(host.writeQuery).toHaveBeenCalledOnce();
    expect(host.deleteRecords).toHaveBeenCalledOnce();
  } finally {
    stream.dispose();
  }
});

it('delivers without a cache and stops receipt when the subscription is disposed', async () => {
  const onPatch = vi.fn();
  const stream = subscribe([notificationReceiptExchange(onPatch)], vi.fn());
  await stream.attached;
  stream.emit(NEW_NOTIFICATION);
  expect(onPatch).toHaveBeenCalledExactlyOnceWith(NEW_NOTIFICATION);
  stream.dispose();
  expect(stream.unsubscribe).toHaveBeenCalledOnce();
  stream.emit(DELETION);
  expect(onPatch).toHaveBeenCalledOnce();
});
