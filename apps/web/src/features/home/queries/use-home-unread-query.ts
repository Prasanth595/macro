import { createLiveQuery } from '@graphql-cache/solid/create-live-query';
import { registerActivityRevalidator } from '@queries/activity/push-registry';
import { registerChannelNotificationRefresh } from '@queries/channel/register-notification-refresh';
import {
  registerActiveGraphqlSoupQuery,
  registerGraphqlSoupRevalidations,
} from '@queries/soup/graphql/active-queries';
import { makeGraphqlSoupInput } from '@queries/soup/graphql/ast';
import {
  HomeUnreadPresenceDocument,
  type HomeUnreadPresenceQuery,
} from '@service-storage/graphql/generated/graphql';
import { getGraphqlSoupClient } from '@service-storage/graphql-soup';
import { type Accessor, createMemo, onCleanup } from 'solid-js';
import { buildHomeQuery } from './home-query';
import { hasHomeUnreadWitness } from './home-unread';
import { useHomeEntitiesQuery } from './use-home-query';

const selectItems = (data: HomeUnreadPresenceQuery) => data.user.soup.items;

/** Home's existing membership, with bounded state-only edges rather than history. */
export function useHomeUnreadQuery(
  graphqlEnabled: Accessor<boolean>
): Accessor<boolean> {
  // Retain REST rollout behavior, but never mount an enabled full Soup reader
  // alongside the GraphQL witness query. Its context also owns the shared flags.
  const legacy = useHomeEntitiesQuery(
    { tab: 'signal', facets: { read: ['unread'] } },
    { enabled: () => !graphqlEnabled() }
  );
  const variables = createMemo(() => ({
    input: makeGraphqlSoupInput(buildHomeQuery(legacy.viewContext())),
  }));
  const query = createLiveQuery(HomeUnreadPresenceDocument, variables, () => ({
    client: getGraphqlSoupClient(),
    enabled: graphqlEnabled(),
    requestPolicy: 'cache-and-network',
    select: selectItems,
  }));
  const items = () => (!query.isPending ? (query.data ?? []) : []);
  const queries = () => [
    { document: HomeUnreadPresenceDocument, variables: variables() },
  ];
  const refresh = registerChannelNotificationRefresh(() => ({
    client: getGraphqlSoupClient(),
    queries: queries(),
    reader: {
      enabled: graphqlEnabled(),
      fetching: query.isFetching,
      filtered: true,
      scope: 'all-entities',
      notificationIds: items().flatMap((item) => [
        ...item.unreadNotifications.map((notification) => notification.id),
        ...(item.__typename === 'GraphqlSoupEmailThread'
          ? item.unreadReminders.map((notification) => notification.id)
          : []),
      ]),
    },
  }));
  onCleanup(
    registerGraphqlSoupRevalidations(
      () => (graphqlEnabled() ? queries() : []),
      getGraphqlSoupClient
    )
  );
  onCleanup(
    registerActiveGraphqlSoupQuery({ isEnabled: graphqlEnabled, refresh })
  );
  onCleanup(
    registerActivityRevalidator({
      client: getGraphqlSoupClient,
      refresh: async () => {
        if (graphqlEnabled()) await refresh();
      },
    })
  );

  return () => {
    if (!graphqlEnabled()) {
      if (legacy.query.isLoading) return false;
      return legacy.hasUnreadEntity(legacy.query.data?.entities ?? []);
    }
    return hasHomeUnreadWitness(
      items(),
      legacy.viewContext().capabilities,
      legacy.notificationSource
    );
  };
}
