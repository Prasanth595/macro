import {
  enableGraphqlSoup,
  isFeatureEnabled,
} from '@core/constant/featureFlags';
import { fireAndForget } from '@core/util/fireAndForget';
import { refreshSoupEntities } from '@queries/soup/refresh';
import { AgentSessionRowDocument } from '@service-storage/graphql/generated/graphql';
import { getGraphqlSoupClient } from '@service-storage/graphql-soup';

const changedSessions = new Set<string>();
let pending: Promise<void> | undefined;

/**
 * Re-read each session's row from the primary into the normalized GraphQL
 * cache. Every GraphQL Soup list shares that record, so this updates them all
 * without refetching any list; a replica-backed list refetch could return the
 * row from before the change and leave it there.
 */
async function refreshGraphqlSessionRows(sessions: string[]): Promise<void> {
  if (!isFeatureEnabled(enableGraphqlSoup)) return;
  const client = getGraphqlSoupClient();
  await Promise.all(
    sessions.map(async (sessionId) => {
      const result = await client
        .query(
          AgentSessionRowDocument,
          { sessionId },
          { requestPolicy: 'network-only' }
        )
        .toPromise();
      if (result.error) throw result.error;
    })
  );
}

async function refreshQueuedLists(resolve: () => void): Promise<void> {
  let retryAvailable = true;
  try {
    while (changedSessions.size) {
      const sessions = [...changedSessions];
      changedSessions.clear();
      try {
        await Promise.all([
          refreshSoupEntities(sessions, { throwOnError: true }),
          refreshGraphqlSessionRows(sessions),
        ]);
      } catch (error) {
        for (const session of sessions) changedSessions.add(session);
        if (!retryAvailable) throw error;
        retryAvailable = false;
      }
    }
  } catch (error) {
    // Gateway event handlers are fire-and-forget. Report exhaustion without
    // rejecting their unobserved promises; the queued batch remains intact.
    console.error('[agent-session] failed to refresh session lists', error);
  } finally {
    pending = undefined;
    resolve();
  }
}

/**
 * Refresh the lists that show a session after its metadata changes: REST
 * lists refetch, GraphQL lists get the session's row re-read.
 * A burst shares one pass; updates committed during a fetch get a later pass.
 * A failed pass retries once with queued updates. Further failures retain the
 * batch for the next event instead of dropping it or spinning.
 */
export function refreshAgentSessionLists(sessionId: string): Promise<void> {
  changedSessions.add(sessionId);

  if (!pending) {
    pending = new Promise<void>((resolve) => {
      queueMicrotask(() =>
        fireAndForget(refreshQueuedLists(resolve), 'agent-session-lists')
      );
    });
  }
  return pending;
}
