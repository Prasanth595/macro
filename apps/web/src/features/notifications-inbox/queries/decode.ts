import { mapApiSoupItemToEntity } from '@queries/soup/transform-utils';
import { workFeedSoupItem } from '@queries/work-feed/work-feed-entity';
import type {
  NotificationInboxEntryFieldsFragment,
  WorkFeedRowType,
  WorkFeedScopeInput,
} from '@service-storage/graphql/generated/graphql';
import { mapGraphqlNotification } from '@service-storage/graphql-soup';
import { match } from 'ts-pattern';
import type { InboxScope } from '../context/notifications-inbox-context';
import { ALL_INBOX_ROW_TYPES } from '../core/inbox-filters';
import type { InboxRowType } from '../core/inbox-row';
import type { WorkFeedInboxEntry } from './work-feed-entries';

/** Undefined for a row type this build does not know; such rows are skipped. */
const toRowType = (type: WorkFeedRowType): InboxRowType | undefined =>
  match<WorkFeedRowType, InboxRowType | undefined>(type)
    .with('AI_SUGGESTION', () => 'ai_suggestion' as const)
    .with('AGENT', () => 'agent' as const)
    .with('EMAIL', () => 'email' as const)
    .with('CHANNEL_MENTION', () => 'channel_mention' as const)
    .with('CHANNEL_MESSAGES', () => 'channel_messages' as const)
    .with('CHANNEL_THREAD', () => 'channel_thread' as const)
    .with('DISCUSSION_MENTION', () => 'discussion_mention' as const)
    .with('DISCUSSION_MESSAGES', () => 'discussion_messages' as const)
    .with('DISCUSSION_THREAD', () => 'discussion_thread' as const)
    .with('TASK', () => 'task' as const)
    .with('PULL_REQUEST', () => 'pull_request' as const)
    .with('CALENDAR_EVENT', () => 'calendar_event' as const)
    .with('CALENDAR_JOIN_REQUEST', () => 'calendar_join_request' as const)
    .with('ACCESS_REQUESTED', () => 'access_requested' as const)
    .with('ACCESS_GRANTED', () => 'access_granted' as const)
    .exhaustive(() => undefined);

const toGraphqlRowType = (type: InboxRowType): WorkFeedRowType =>
  match(type)
    .with('ai_suggestion', () => 'AI_SUGGESTION' as const)
    .with('agent', () => 'AGENT' as const)
    .with('email', () => 'EMAIL' as const)
    .with('channel_mention', () => 'CHANNEL_MENTION' as const)
    .with('channel_messages', () => 'CHANNEL_MESSAGES' as const)
    .with('channel_thread', () => 'CHANNEL_THREAD' as const)
    .with('discussion_mention', () => 'DISCUSSION_MENTION' as const)
    .with('discussion_messages', () => 'DISCUSSION_MESSAGES' as const)
    .with('discussion_thread', () => 'DISCUSSION_THREAD' as const)
    .with('task', () => 'TASK' as const)
    .with('pull_request', () => 'PULL_REQUEST' as const)
    .with('calendar_event', () => 'CALENDAR_EVENT' as const)
    .with('calendar_join_request', () => 'CALENDAR_JOIN_REQUEST' as const)
    .with('access_requested', () => 'ACCESS_REQUESTED' as const)
    .with('access_granted', () => 'ACCESS_GRANTED' as const)
    .exhaustive(() => {
      throw new Error(`Unknown inbox row type: ${type}`);
    });

/**
 * Encode an inbox scope as the attention feed it reads. Every known type
 * reads every row, including row types a newer server adds.
 */
export function encodeInboxScope(scope: InboxScope): WorkFeedScopeInput {
  const everyType = ALL_INBOX_ROW_TYPES.every((type) =>
    scope.rowTypes.includes(type)
  );
  return {
    mode: 'ATTENTION',
    includeSnippets: true,
    rowTypes: everyType ? [] : scope.rowTypes.map(toGraphqlRowType),
  };
}

/**
 * Project one attention feed entry into inbox rows. Each row's entity
 * carries only that row's notifications, so entity-based helpers (icons,
 * preview targets) see what the row shows. An entity the app does not list,
 * or an entry without a valid place, is dropped.
 */
export function toInboxEntry(
  entry: NotificationInboxEntryFieldsFragment
): WorkFeedInboxEntry | null {
  const sortAt = Date.parse(entry.sortAt);
  const soupItem = workFeedSoupItem(entry.item.entity);
  if (!soupItem || Number.isNaN(sortAt)) return null;
  const entity = mapApiSoupItemToEntity(soupItem);
  return {
    itemId: entry.item.id,
    sortAt,
    rows: entry.rows.flatMap((row) => {
      const latestAt = Date.parse(row.latestAt);
      const type = toRowType(row.rowType);
      if (Number.isNaN(latestAt) || type === undefined) return [];
      const notifications = row.notifications.map(mapGraphqlNotification);
      return [
        {
          id: row.id,
          type,
          revision: row.revision,
          latestAt,
          unseen: row.unseen,
          count: row.count,
          content: { entity: { ...entity, notifications }, notifications },
        },
      ];
    }),
  };
}
