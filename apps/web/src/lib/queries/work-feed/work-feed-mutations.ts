import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import {
  MarkWorkFeedItemsDoneDocument,
  type UndoWorkFeedItemsDoneInput,
} from '@service-storage/graphql/generated/graphql';
import type { Client } from '@urql/core';

/**
 * The reasons a viewer observed on one item, as done acknowledges them. With
 * a `rowId`, only that notification inbox row is acknowledged, up to the
 * row's `revision`.
 */
export type WorkFeedDoneItem = {
  itemId: string;
  revision: string;
  rowId?: string;
};

/** Mark items done; resolves to the token that reverses exactly this done. */
export async function markWorkFeedItemsDone(
  client: Client,
  items: readonly WorkFeedDoneItem[]
): Promise<{ undoToken: string }> {
  const result = await client
    .mutation(MarkWorkFeedItemsDoneDocument, {
      input: {
        items: items.map((item) => ({
          id: item.itemId,
          revision: item.revision,
          ...(item.rowId === undefined ? {} : { rowId: item.rowId }),
        })),
      },
    })
    .toPromise();
  const payload = result.data?.markWorkFeedItemsDone;
  if (result.error || !payload) {
    throw result.error ?? new Error('Marking work feed items done failed');
  }
  return { undoToken: payload.undoToken };
}

/**
 * Reverse one done; resolves to the restored items' places in the feed the
 * input's scope names, selected by the caller's patch fragment.
 */
export async function undoWorkFeedItemsDone<Patch>(
  client: Client,
  document: TypedDocumentNode<
    { undoWorkFeedItemsDone: { patches: Patch[] } },
    { input: UndoWorkFeedItemsDoneInput }
  >,
  input: UndoWorkFeedItemsDoneInput
): Promise<Patch[]> {
  const result = await client.mutation(document, { input }).toPromise();
  const payload = result.data?.undoWorkFeedItemsDone;
  if (result.error || !payload) {
    throw result.error ?? new Error('Undoing work feed done failed');
  }
  return payload.patches;
}
