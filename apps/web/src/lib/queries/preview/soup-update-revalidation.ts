import type { SoupUpdatesSubscription } from '@service-storage/graphql/generated/graphql';
import { refreshActiveGraphqlPreviewQueries } from './active-queries';

type SoupPatch = SoupUpdatesSubscription['soupUpdates'][number];

function patchedEntityId(patch: SoupPatch): string {
  return patch.__typename === 'SoupUpdated' ? patch.item.id : patch.entityId;
}

/**
 * `soupUpdates` carries every change to an entity, whoever made it (the app,
 * an agent, an MCP tool). When the normalized cache applied the patch, mounted
 * previews already read the new record. Without a cache host, nothing stores
 * the patch, so mounted previews of the patched entities refetch instead.
 */
export async function revalidatePreviewsForSoupUpdates(
  patches: readonly SoupPatch[],
  cacheEffectsApplied: boolean
): Promise<void> {
  if (cacheEffectsApplied) return;
  const entityIds = new Set(patches.map(patchedEntityId));
  await Promise.all(
    [...entityIds].map((entityId) =>
      refreshActiveGraphqlPreviewQueries(entityId)
    )
  );
}
