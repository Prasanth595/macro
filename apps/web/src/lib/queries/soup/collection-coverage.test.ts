import type { CacheHost } from '@graphql-cache/host/types';
import { parseCacheRevision } from '@graphql-cache/protocol';
import { describe, expect, it, vi } from 'vitest';
import { beginCollectionCoverageScan } from './collection-coverage';

const revision = parseCacheRevision('1');

describe('collection coverage scans', () => {
  it('persists every explicit document member in bounded batches before publication', async () => {
    const coverage = vi.fn<NonNullable<CacheHost['collectionCoverage']>>(
      async (request) =>
        request.kind === 'begin'
          ? { kind: 'started', scanId: 'scan', revision }
          : { kind: 'committed', revision }
    );
    const scan = await beginCollectionCoverageScan(
      { collectionCoverage: coverage },
      'viewer',
      'generation',
      { kind: 'documents' }
    );
    const keys = Array.from(
      { length: 1_201 },
      (_, id) => `GraphqlSoupDocument:${id}`
    );
    expect(
      await scan?.append([...keys, keys[0], 'GraphqlSoupProject:project'])
    ).toBe(true);
    expect(
      coverage.mock.calls.some(([request]) => request.kind === 'complete')
    ).toBe(false);
    expect(await scan?.complete()).toBe(true);
    expect(
      coverage.mock.calls.flatMap(([request]) =>
        request.kind === 'append' ? request.keys : []
      )
    ).toEqual(keys);
    expect(
      coverage.mock.calls
        .filter(([request]) => request.kind === 'append')
        .map(([request]) =>
          request.kind === 'append' ? request.keys.length : 0
        )
    ).toEqual([500, 500, 201]);
    expect(coverage.mock.lastCall?.[0]).toEqual({
      kind: 'complete',
      userId: 'viewer',
      storageGeneration: 'generation',
      scanId: 'scan',
    });
  });

  it('never publishes after an append loses its generation or invalidation fence', async () => {
    const coverage = vi.fn<NonNullable<CacheHost['collectionCoverage']>>(
      async (request) =>
        request.kind === 'begin'
          ? { kind: 'started', scanId: 'scan', revision }
          : { kind: 'incomplete', revision }
    );
    const scan = await beginCollectionCoverageScan(
      { collectionCoverage: coverage },
      'viewer',
      'generation',
      { kind: 'filter', filters: {} }
    );
    expect(await scan?.append(['GraphqlSoupDocument:a'])).toBe(false);
    expect(await scan?.append(['GraphqlSoupDocument:b'])).toBe(false);
    expect(await scan?.complete()).toBe(false);
    expect(coverage).toHaveBeenCalledTimes(2);
  });

  it('publishes a successful empty scan but does not invent support on older runtimes', async () => {
    const coverage = vi.fn<NonNullable<CacheHost['collectionCoverage']>>(
      async (request) =>
        request.kind === 'begin'
          ? { kind: 'started', scanId: 'scan', revision }
          : { kind: 'committed', revision }
    );
    const scan = await beginCollectionCoverageScan(
      { collectionCoverage: coverage },
      'viewer',
      'generation',
      { kind: 'documents' }
    );
    expect(await scan?.append([])).toBe(true);
    expect(await scan?.complete()).toBe(true);
    expect(coverage).toHaveBeenCalledTimes(2);
    expect(
      await beginCollectionCoverageScan({}, 'viewer', 'generation', {
        kind: 'documents',
      })
    ).toBeUndefined();
  });
});
