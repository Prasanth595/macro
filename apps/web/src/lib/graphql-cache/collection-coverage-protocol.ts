import type { CacheRevision } from './cache-revision';
import {
  isValidNormalizedRecordKey,
  MAX_RECORD_SELECTION_PAGE_SIZE,
} from './record-selection-protocol';

const isWireRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const hasOnlyWireKeys = (
  value: Record<string, unknown>,
  keys: readonly string[]
): boolean => Object.keys(value).every((key) => keys.includes(key));

/** A broad document corpus or one exact Soup filter, independent of grouping. */
export type CollectionCoverageScope =
  | { kind: 'documents' }
  | { kind: 'filter'; filters: Record<string, unknown> };

/** Persist membership before publishing a completed scan; invalidate fences scans. */
export type CollectionCoverageRequest =
  | {
      kind: 'begin';
      userId: string;
      storageGeneration: string;
      scope: CollectionCoverageScope;
    }
  | {
      kind: 'append';
      userId: string;
      storageGeneration: string;
      scanId: string;
      keys: string[];
    }
  | {
      kind: 'complete';
      userId: string;
      storageGeneration: string;
      scanId: string;
    }
  | { kind: 'invalidate' };

export type CollectionCoverageCacheResult =
  | { kind: 'started'; scanId: string; revision: CacheRevision }
  | { kind: 'committed'; revision: CacheRevision }
  | { kind: 'incomplete'; revision: CacheRevision }
  | { kind: 'unsupported' };

/** Validate the additive coverage RPC before routing untrusted worker messages. */
export function isCollectionCoverageRequest(
  value: unknown
): value is CollectionCoverageRequest {
  if (!isWireRecord(value)) return false;
  if (value.kind === 'invalidate') return hasOnlyWireKeys(value, ['kind']);
  const boundedString = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0 && value.length <= 256;
  if (!boundedString(value.userId) || !boundedString(value.storageGeneration))
    return false;
  if (value.kind === 'begin') {
    const scope = value.scope;
    return (
      hasOnlyWireKeys(value, [
        'kind',
        'userId',
        'storageGeneration',
        'scope',
      ]) &&
      isWireRecord(scope) &&
      ((scope.kind === 'documents' && hasOnlyWireKeys(scope, ['kind'])) ||
        (scope.kind === 'filter' &&
          hasOnlyWireKeys(scope, ['kind', 'filters']) &&
          isWireRecord(scope.filters)))
    );
  }
  if (!boundedString(value.scanId)) return false;
  if (value.kind === 'complete')
    return hasOnlyWireKeys(value, [
      'kind',
      'userId',
      'storageGeneration',
      'scanId',
    ]);
  return (
    value.kind === 'append' &&
    hasOnlyWireKeys(value, [
      'kind',
      'userId',
      'storageGeneration',
      'scanId',
      'keys',
    ]) &&
    Array.isArray(value.keys) &&
    value.keys.length <= MAX_RECORD_SELECTION_PAGE_SIZE &&
    value.keys.every(
      (key) =>
        isValidNormalizedRecordKey(key) &&
        key.startsWith('GraphqlSoupDocument:')
    )
  );
}
