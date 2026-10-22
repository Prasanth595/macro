import type { ServerPreparedBody } from '@app/features/email-message/context/email-rendering-context';
import {
  enableServerEmailPreparation,
  isFeatureEnabled,
} from '@core/constant/featureFlags';
import { DEFAULT_THREAD_MESSAGES_LIMIT } from '@core/constant/pagination';
import { fireAndForget } from '@core/util/fireAndForget';
import type { CachedPreparedBody } from '@queries/email/graphql/thread';
import { EmailThreadPreparedBodiesDocument } from '@service-storage/graphql/generated/graphql';
import type { Client } from '@urql/core';
import { type Accessor, createEffect, on } from 'solid-js';

/**
 * The server preparation version this client can mount. `EmailThreadPage`
 * reads `preparedBody(version: 1)`; keep the two equal.
 */
export const SERVER_PREPARE_VERSION = 1;

/** A cached server body this client can mount, or `undefined`. */
export function toServerPreparedBody(
  prepared: CachedPreparedBody | undefined
): ServerPreparedBody | undefined {
  if (prepared?.version !== SERVER_PREPARE_VERSION) return undefined;
  return {
    body: {
      html: prepared.html,
      kind: 'html',
      hasTable: prepared.hasTable,
      hasHiddenContent: prepared.hasHiddenContent,
    },
    imageProxyUrl: prepared.imageProxyUrl ?? null,
    sourceLength: prepared.sourceLength,
  };
}

/**
 * Fetches server-prepared bodies for a thread's first page into the cache,
 * once per device. The thread page reads them from there (`@fromCache`), so
 * they are on hand the next time the thread renders. A one-shot request: a
 * live query would ask again each time the thread page's refresh writes the
 * same messages while the first request is still in flight.
 */
export function createPreparedBodiesFill(
  threadId: Accessor<string>,
  enabled: Accessor<boolean>,
  client: Accessor<Pick<Client, 'query'>>
): void {
  createEffect(
    on([threadId, enabled], ([id, on]) => {
      if (!on || !id || !isFeatureEnabled(enableServerEmailPreparation)) return;
      fireAndForget(
        client()
          .query(
            EmailThreadPreparedBodiesDocument,
            {
              threadId: id,
              offset: 0,
              limit: DEFAULT_THREAD_MESSAGES_LIMIT,
              version: SERVER_PREPARE_VERSION,
            },
            // A prepared body only changes with its source or version, and the
            // client checks both, so a cached one is never prepared again.
            { requestPolicy: 'cache-first' }
          )
          .toPromise(),
        'email-thread'
      );
    })
  );
}
