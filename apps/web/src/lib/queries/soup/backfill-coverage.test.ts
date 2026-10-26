import type { CacheHost } from '@graphql-cache/host/types';
import { parseCacheRevision } from '@graphql-cache/protocol';
import * as Effect from 'effect/Effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadSoupBackfillCheckpoint,
  runSoupBackfill,
  type SoupBackfillParams,
} from './backfill';

vi.mock('@app/lib/analytics/posthog', () => ({ useFeatureFlag: vi.fn() }));
vi.mock('@core/cross-tab/tab-leader', () => ({
  createTabLeaderSignal: vi.fn(),
}));
vi.mock('@service-storage/graphql-soup', () => ({
  getGraphqlSoupCacheHost: vi.fn(),
  hydrateGraphqlSoup: vi.fn(),
  subscribeGraphqlSoupReconnected: () => () => {},
}));

const revision = parseCacheRevision('1');
const params: SoupBackfillParams = {
  checkpointId: 'documents',
  collectionScope: { kind: 'documents' },
  catchUpAfterInitialPass: true,
  pageDelayMs: 0,
  input: { limit: 100, expand: true, sortMethod: 'UPDATED_AT' },
};

beforeEach(() => localStorage.clear());

describe('backfill collection coverage', () => {
  it('publishes only after the full scan and its persisted catch-up finish', async () => {
    const events: string[] = [];
    const coverage = vi.fn<NonNullable<CacheHost['collectionCoverage']>>(
      async (request) => {
        events.push(request.kind);
        return request.kind === 'begin'
          ? { kind: 'started', scanId: 'scan', revision }
          : { kind: 'committed', revision };
      }
    );
    let page = 0;
    const fetchPage = vi.fn<NonNullable<SoupBackfillParams['fetchPage']>>(
      async () => {
        page += 1;
        events.push(`persisted:${page}`);
        return {
          nextCursor: page === 1 ? 'next' : null,
          entityKeys: [`GraphqlSoupDocument:${page}`],
        };
      }
    );
    await Effect.runPromise(
      runSoupBackfill(
        'viewer',
        {
          currentStorageGeneration: async () => 'generation',
          collectionCoverage: coverage,
        },
        { ...params, fetchPage }
      )
    );
    expect(events).toEqual([
      'begin',
      'persisted:1',
      'append',
      'persisted:2',
      'append',
      'persisted:3',
      'append',
      'complete',
    ]);
    expect(fetchPage.mock.calls[1][0]).toMatchObject({
      continuation: { cursor: 'next' },
    });
    expect(fetchPage.mock.calls[2][0]).toHaveProperty(
      'initial.filters.documentFilter'
    );
    expect(loadSoupBackfillCheckpoint('viewer', 'documents').completed).toBe(
      true
    );
  });

  it('does not promote missing membership evidence or a failed persistence operation', async () => {
    const coverage = vi.fn<NonNullable<CacheHost['collectionCoverage']>>(
      async (request) =>
        request.kind === 'begin'
          ? { kind: 'started', scanId: 'scan', revision }
          : { kind: 'committed', revision }
    );
    const host = {
      currentStorageGeneration: async () => 'generation',
      collectionCoverage: coverage,
    };
    await Effect.runPromise(
      runSoupBackfill('viewer', host, {
        ...params,
        catchUpAfterInitialPass: false,
        fetchPage: async () => ({ nextCursor: null }),
      })
    );
    expect(coverage.mock.calls.map(([request]) => request.kind)).toEqual([
      'begin',
    ]);
    coverage.mockClear();
    await expect(
      Effect.runPromise(
        runSoupBackfill('viewer', host, {
          ...params,
          fetchPage: async () => {
            throw new Error('disk write failed');
          },
        })
      )
    ).rejects.toThrow();
    expect(coverage.mock.calls.map(([request]) => request.kind)).toEqual([
      'begin',
    ]);
  });

  it('discards old-generation pages and starts a fresh membership scan after a reset', async () => {
    let generation = 'old';
    const coverage = vi.fn<NonNullable<CacheHost['collectionCoverage']>>(
      async (request) =>
        request.kind === 'begin'
          ? { kind: 'started', scanId: request.storageGeneration, revision }
          : { kind: 'committed', revision }
    );
    const fetchPage = vi.fn<NonNullable<SoupBackfillParams['fetchPage']>>(
      async () => {
        if (fetchPage.mock.calls.length === 1) {
          generation = 'new';
          return {
            nextCursor: 'obsolete',
            entityKeys: ['GraphqlSoupDocument:old'],
          };
        }
        return { nextCursor: null, entityKeys: ['GraphqlSoupDocument:new'] };
      }
    );
    await Effect.runPromise(
      runSoupBackfill(
        'viewer',
        {
          currentStorageGeneration: async () => generation,
          collectionCoverage: coverage,
        },
        { ...params, catchUpAfterInitialPass: false, fetchPage }
      )
    );
    expect(fetchPage.mock.calls[1][0]).toHaveProperty('initial');
    expect(coverage.mock.calls.map(([request]) => request)).toEqual([
      {
        kind: 'begin',
        userId: 'viewer',
        storageGeneration: 'old',
        scope: { kind: 'documents' },
      },
      {
        kind: 'begin',
        userId: 'viewer',
        storageGeneration: 'new',
        scope: { kind: 'documents' },
      },
      {
        kind: 'append',
        userId: 'viewer',
        storageGeneration: 'new',
        scanId: 'new',
        keys: ['GraphqlSoupDocument:new'],
      },
      {
        kind: 'complete',
        userId: 'viewer',
        storageGeneration: 'new',
        scanId: 'new',
      },
    ]);
  });

  it('never upgrades a resumed incremental cursor into full document coverage', async () => {
    localStorage.setItem(
      'graphql-soup-backfill:v17:viewer:documents',
      JSON.stringify({
        userId: 'viewer',
        storageGeneration: 'generation',
        nextCursor: 'incremental',
        pagesFetched: 8,
        completed: false,
        scanStartedAt: '2026-10-01T00:00:00Z',
        updatedSince: '2026-09-30T00:00:00Z',
        completedAt: null,
      })
    );
    const coverage = vi.fn<NonNullable<CacheHost['collectionCoverage']>>(
      async (request) =>
        request.kind === 'begin'
          ? { kind: 'started', scanId: 'scan', revision }
          : { kind: 'committed', revision }
    );
    const fetchPage = vi.fn(async () => ({ nextCursor: null, entityKeys: [] }));
    await Effect.runPromise(
      runSoupBackfill(
        'viewer',
        {
          currentStorageGeneration: async () => 'generation',
          collectionCoverage: coverage,
        },
        { ...params, catchUpAfterInitialPass: false, fetchPage }
      )
    );
    expect(fetchPage).toHaveBeenCalledExactlyOnceWith(
      { initial: params.input },
      expect.anything()
    );
    expect(coverage.mock.lastCall?.[0].kind).toBe('complete');
  });
});
