/** Opaque in-memory revision of one live cache engine generation. */
export type CacheRevision = string & {
  readonly __cacheRevision: unique symbol;
};

const MAX_CACHE_REVISION = 18_446_744_073_709_551_615n;

/** Validates the canonical unsigned-decimal Rust `u64` wire representation. */
export function isCacheRevision(value: unknown): value is CacheRevision {
  return (
    typeof value === 'string' &&
    /^(0|[1-9][0-9]*)$/.test(value) &&
    BigInt(value) <= MAX_CACHE_REVISION
  );
}

/** Parses an untrusted cache revision at protocol ingress. */
export function parseCacheRevision(value: unknown): CacheRevision {
  if (!isCacheRevision(value)) {
    throw new TypeError('invalid cache revision');
  }
  return value;
}

export const INITIAL_CACHE_REVISION = '0' as CacheRevision;

/** Validates the durable database-generation UUID shared by cache hosts. */
export function parseStorageGeneration(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      value
    )
  ) {
    throw new TypeError('invalid cache storage generation');
  }
  return value;
}
