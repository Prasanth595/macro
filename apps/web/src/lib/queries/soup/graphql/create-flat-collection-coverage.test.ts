import { createNoopCacheHost } from '@graphql-cache/host/noop-host';
import type { CacheHost } from '@graphql-cache/host/types';
import { parseCacheRevision } from '@graphql-cache/protocol';
import {
  SoupDocument,
  type SoupItemFieldsFragment,
  type SoupQuery,
  type SoupQueryVariables,
} from '@service-storage/graphql/generated/graphql';
import { createRequest, makeOperation, type OperationResult } from '@urql/core';
import { createRoot, createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFlatCollectionCoverage } from './create-flat-collection-coverage';
import { groupedDocument } from './grouped-test-fixtures';

const mocks = vi.hoisted(() => ({ host: vi.fn() }));
vi.mock('@service-storage/graphql-soup', () => ({
  getGraphqlSoupCacheHost: mocks.host,
}));
const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach((dispose) => dispose()));
const operation = makeOperation(
  'query',
  createRequest(SoupDocument, {
    input: { initial: { sortMethod: 'UPDATED_AT' } },
  }),
  { url: 'unused', requestPolicy: 'network-only' }
);

function page(
  items: SoupItemFieldsFragment[],
  nextCursor: string | null,
  persistence: Promise<string | undefined>,
  userId = 'viewer'
): OperationResult<SoupQuery, SoupQueryVariables> {
  return {
    operation,
    data: { user: { id: userId, emailLinks: [], soup: { items, nextCursor } } },
    hasNext: false,
    stale: false,
    extensions: {
      __macroNormalizedCache: { source: 'live-network', persistence },
    },
  };
}

function setup() {
  let published!: () => void;
  const publication = new Promise<void>((resolve) => {
    published = resolve;
  });
  const coverage = vi.fn<NonNullable<CacheHost['collectionCoverage']>>(
    async (request) => {
      if (request.kind === 'complete') published();
      return request.kind === 'begin'
        ? {
            kind: 'started',
            scanId: `${request.userId}-scan`,
            revision: parseCacheRevision('1'),
          }
        : { kind: 'committed', revision: parseCacheRevision('2') };
    }
  );
  const host: CacheHost = {
    ...createNoopCacheHost(),
    disabled: false,
    currentStorageGeneration: async () => 'generation',
    collectionCoverage: coverage,
  };
  mocks.host.mockReturnValue(host);
  const state = createRoot((dispose) => {
    cleanups.push(dispose);
    const [userId, setUserId] = createSignal('viewer');
    const source = createFlatCollectionCoverage({
      input: () => ({ sortMethod: 'UPDATED_AT', filters: {} }),
      userId,
      enabled: () => true,
      scope: () => 'tasks',
    });
    return { source, setUserId };
  });
  return { ...state, coverage, publication };
}

describe('flat foreground collection coverage', () => {
  it('waits for every page persistence acknowledgement, even when acknowledgements arrive out of order', async () => {
    const state = setup();
    await state.source.waitUntilReady();
    let firstAck!: (revision: string) => void;
    let lastAck!: (revision: string) => void;
    const first = new Promise<string>((resolve) => {
      firstAck = resolve;
    });
    const last = new Promise<string>((resolve) => {
      lastAck = resolve;
    });
    const scope = state.source.scope();
    state.source.accept(
      page([groupedDocument('a')], 'next', first),
      { pageIndex: 0, pageParam: null },
      scope
    );
    state.source.accept(
      page([groupedDocument('b')], null, last),
      { pageIndex: 1, pageParam: 'next' },
      scope
    );
    lastAck('2');
    await last;
    expect(
      state.coverage.mock.calls.some(([request]) => request.kind === 'complete')
    ).toBe(false);
    firstAck('1');
    await state.publication;
    expect(
      state.coverage.mock.calls.flatMap(([request]) =>
        request.kind === 'append' ? request.keys : []
      )
    ).toEqual(['GraphqlSoupDocument:a', 'GraphqlSoupDocument:b']);
  });

  it('rejects a terminal page disconnected from the acknowledged cursor chain', async () => {
    const state = setup();
    await state.source.waitUntilReady();
    const persisted = Promise.resolve('1');
    const scope = state.source.scope();
    state.source.accept(
      page([groupedDocument('a')], 'expected', persisted),
      { pageIndex: 0, pageParam: null },
      scope
    );
    state.source.accept(
      page([groupedDocument('b')], null, persisted),
      { pageIndex: 1, pageParam: 'different' },
      scope
    );
    await persisted;
    expect(state.coverage.mock.calls.map(([request]) => request.kind)).toEqual([
      'begin',
    ]);
  });

  it('never publishes the previous account membership into a new account scan', async () => {
    const state = setup();
    await state.source.waitUntilReady();
    let acknowledge!: (revision: string) => void;
    const old = new Promise<string>((resolve) => {
      acknowledge = resolve;
    });
    state.source.accept(
      page([groupedDocument('old')], null, old),
      { pageIndex: 0, pageParam: null },
      state.source.scope()
    );
    state.setUserId('new-viewer');
    await state.source.waitUntilReady();
    acknowledge('1');
    await old;
    expect(
      state.coverage.mock.calls.some(([request]) => request.kind === 'complete')
    ).toBe(false);
    state.source.accept(
      page([], null, Promise.resolve('2'), 'new-viewer'),
      { pageIndex: 0, pageParam: null },
      state.source.scope()
    );
    await state.publication;
    expect(state.coverage.mock.lastCall?.[0]).toEqual({
      kind: 'complete',
      userId: 'new-viewer',
      storageGeneration: 'generation',
      scanId: 'new-viewer-scan',
    });
    expect(
      state.coverage.mock.calls.some(([request]) => request.kind === 'append')
    ).toBe(false);
  });
});
