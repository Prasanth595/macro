import { useSplitPanelOrThrow } from '@components/app/split-layout/layoutUtils';
import { getDisplayNameParts, tryMacroId } from '@core/user';
import {
  getGithubSenderLogin,
  isGithubNotificationType,
} from '@entity/extractors-notification/notification-description-helpers';
import { isEntityDiscussionEvent } from '@notifications/entity-discussion';
import {
  getNotificationAgentSender,
  getNotificationSenderFallbackName,
} from '@notifications/notification-sender';
import { setDoneOverride } from '@notifications/notification-source';
import type { UnifiedNotification } from '@notifications/types';
import { revalidateNotificationReaders } from '@queries/notification/revalidation';
import {
  getGraphqlCacheHost,
  getGraphqlSoupClient,
  subscribeGraphqlSoupReconnected,
} from '@service-storage/graphql-soup';
import {
  type NotificationsInboxContext,
  NotificationsInboxProvider,
} from './context/notifications-inbox-context';
import { openNotificationInSplit } from './open-notification-in-split';
import { createWorkFeedInboxSource } from './queries/work-feed-inbox-source';
import { NotificationsView } from './views/notifications-view';

/** Who caused a notification, by the name a row should show. */
function actorName(notification: UnifiedNotification): string | undefined {
  const metadata = notification.notification_metadata;
  if (isEntityDiscussionEvent(metadata) && metadata.content.senderDisplayName) {
    return metadata.content.senderDisplayName;
  }
  // GitHub senders keep their GitHub login, even when linked to Macro.
  if (isGithubNotificationType(metadata.tag)) {
    return getGithubSenderLogin(notification);
  }
  if (notification.sender_id) {
    const parts = getDisplayNameParts(tryMacroId(notification.sender_id), {
      emailFallback: 'local-part',
    });
    return parts.firstName || parts.fullName || undefined;
  }
  return (
    getNotificationAgentSender(notification)?.name ??
    getNotificationSenderFallbackName(notification)
  );
}

function createAppNotificationsInboxContext(): NotificationsInboxContext {
  return {
    createFeed: (scope) =>
      createWorkFeedInboxSource({
        client: getGraphqlSoupClient,
        cacheHost: getGraphqlCacheHost,
        scope,
        enabled: () => true,
        onReconnected: subscribeGraphqlSoupReconnected,
        overrideNotificationsDone: (ids) => setDoneOverride(ids, true),
        revalidateNotifications: revalidateNotificationReaders,
      }),
    actorName,
  };
}

/** The Notifications view with the app's feed and navigation. */
export function NotificationsInbox() {
  const panel = useSplitPanelOrThrow();
  return (
    <NotificationsInboxProvider value={createAppNotificationsInboxContext()}>
      <NotificationsView
        onOpen={(row, { newSplit }) =>
          openNotificationInSplit(row, {
            newSplit,
            splitHandle: panel.handle,
          })
        }
      />
    </NotificationsInboxProvider>
  );
}
