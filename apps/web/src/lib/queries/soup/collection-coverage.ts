import type { CacheHost } from '@graphql-cache/host/types';
import {
  type CollectionCoverageScope,
  MAX_RECORD_SELECTION_PAGE_SIZE,
} from '@graphql-cache/protocol';

export type CollectionCoverageScan = {
  append(keys: readonly string[]): Promise<boolean>;
  complete(): Promise<boolean>;
};

/** Only explicitly returned document identities establish scan membership. */
export async function beginCollectionCoverageScan(
  host: Pick<CacheHost, 'collectionCoverage' | 'disabled'>,
  userId: string,
  storageGeneration: string,
  scope: CollectionCoverageScope
): Promise<CollectionCoverageScan | undefined> {
  const coverage = host.collectionCoverage?.bind(host);
  if (!coverage || host.disabled) return undefined;
  const started = await coverage({
    kind: 'begin',
    userId,
    storageGeneration,
    scope,
  });
  if (started.kind !== 'started') return undefined;
  const identity = { userId, storageGeneration, scanId: started.scanId };
  let valid = true;
  return {
    async append(keys) {
      if (!valid) return false;
      const documents = [...new Set(keys)].filter((key) =>
        key.startsWith('GraphqlSoupDocument:')
      );
      try {
        for (
          let offset = 0;
          offset < documents.length;
          offset += MAX_RECORD_SELECTION_PAGE_SIZE
        ) {
          const result = await coverage({
            kind: 'append',
            ...identity,
            keys: documents.slice(
              offset,
              offset + MAX_RECORD_SELECTION_PAGE_SIZE
            ),
          });
          if (result.kind !== 'committed') {
            valid = false;
            return false;
          }
        }
        return true;
      } catch (error) {
        valid = false;
        throw error;
      }
    },
    async complete() {
      if (!valid) return false;
      const result = await coverage({ kind: 'complete', ...identity });
      valid = false;
      return result.kind === 'committed';
    },
  };
}
