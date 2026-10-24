import {
  enableGraphqlSoup,
  isFeatureEnabled,
} from '@core/constant/featureFlags';
import { fireAndForget } from '@core/util/fireAndForget';
import {
  getSoupEntityById,
  hasSoupEntity,
  hydrateSoupEntity,
} from '@queries/soup/normalized-cache';
import { refreshSoupEntities } from '@queries/soup/refresh';
import { AgentSessionRowDocument } from '@service-storage/graphql/generated/graphql';
import {
  getGraphqlSoupClient,
  mapGraphqlAgentSessionRow,
} from '@service-storage/graphql-soup';

const changedSessions = new Set<string>();
let pending: Promise<void> | undefined;

/**
 * Read each session's row from the primary and apply it to every list holding
 * it: GraphQL lists share the normalized record the read writes, REST lists
 * the normalized entity hydrated from it. Runs after the REST list refetch,
 * which reads a replica that can still return the row from before the change.
 */
async function readSessionRows(sessions: string[]): Promise<void> {
  const graphqlLists = isFeatureEnabled(enableGraphqlSoup);
  const held = sessions.filter((id) => graphqlLists || hasSoupEntity(id));
  if (held.length === 0) return;
  const client = getGraphqlSoupClient();
  await Promise.all(
    held.map(async (sessionId) => {
      const result = await client
        .query(
          AgentSessionRowDocument,
          { sessionId },
          { requestPolicy: 'network-only' }
        )
        .toPromise();
      if (result.error) throw result.error;
      const session = result.data?.user.agentSession;
      if (!session) return;
      const cached = getSoupEntityById(session.id);
      if (cached?.tag !== 'agentSession') return;
      hydrateSoupEntity({
        tag: 'agentSession',
        frecency_score: cached.frecency_score,
        data: mapGraphqlAgentSessionRow(session),
      });
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
        await refreshSoupEntities(sessions, { throwOnError: true });
        await readSessionRows(sessions);
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
 * lists refetch, then the session's own row is read from the primary.
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
