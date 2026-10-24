import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { Client } from '@urql/core';
import { pipe, subscribe } from 'wonka';

export type WorkFeedUpdatesHandlers<Patch> = {
  /** One server batch, to apply together. */
  patches: (patches: Patch[]) => void;
  /** The stream errored or ended: changes may be missed until resubscribed. */
  interrupted: () => void;
};

/** Follow one feed's live changes; returns the unsubscribe function. */
export function subscribeToWorkFeedUpdates<
  Patch,
  Variables extends Record<string, unknown>,
>(
  client: Client,
  document: TypedDocumentNode<{ workFeedUpdates: Patch[] }, Variables>,
  variables: Variables,
  handlers: WorkFeedUpdatesHandlers<Patch>
): () => void {
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    handlers.interrupted();
  };
  const { unsubscribe } = pipe(
    client.subscription(document, variables),
    subscribe((result) => {
      if (result.error) {
        end();
        return;
      }
      const patches = result.data?.workFeedUpdates;
      if (!patches || patches.length === 0) return;
      handlers.patches(patches);
    })
  );
  return () => {
    ended = true;
    unsubscribe();
  };
}
