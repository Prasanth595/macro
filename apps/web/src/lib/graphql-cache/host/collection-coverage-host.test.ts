import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type EntityFilterCacheArgs,
  INITIAL_CACHE_REVISION,
} from '../protocol';
import { createTauriCacheHost } from './tauri-host';
import type { CacheHost } from './types';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => {}),
  emit: vi.fn(async () => {}),
}));
const hosts: CacheHost[] = [];
afterEach(() => hosts.splice(0).forEach((host) => host.dispose()));
beforeEach(() => invoke.mockReset());
const begin = {
  kind: 'begin',
  userId: 'viewer',
  storageGeneration: '00000000-0000-4000-8000-000000000001',
  scope: { kind: 'documents' },
} as const;
const args: EntityFilterCacheArgs = {
  filters: {},
  sortMethod: 'UPDATED_AT',
  sortDirection: 'DESC',
  limit: 100,
  collection: { userId: 'viewer' },
  liveQuery: {
    id: 'view',
    document: 'fragment Row on GraphqlSoupDocument { id }',
    fragmentName: 'Row',
  },
};

describe('native collection coverage compatibility', () => {
  it('remembers a missing coverage command without disabling existing predicate reads', async () => {
    invoke.mockImplementation(async (command: string) => {
      if (command === 'graphql_cache_collection_coverage')
        throw 'Command graphql_cache_collection_coverage not found';
      if (command === 'graphql_cache_entity_filter')
        return {
          kind: 'complete',
          keys: [],
          optimistic: false,
          revision: INITIAL_CACHE_REVISION,
        };
      return null;
    });
    const host = createTauriCacheHost({ scope: 'old-native' });
    hosts.push(host);
    await expect(host.collectionCoverage?.(begin)).resolves.toEqual({
      kind: 'unsupported',
    });
    await expect(host.collectionCoverage?.(begin)).resolves.toEqual({
      kind: 'unsupported',
    });
    await expect(host.entityFilter(args)).resolves.toEqual({
      kind: 'unsupported',
    });
    await expect(
      host.entityFilter({
        filters: {},
        sortMethod: 'UPDATED_AT',
        sortDirection: 'DESC',
        limit: 100,
      })
    ).resolves.toMatchObject({ kind: 'complete' });
    expect(
      invoke.mock.calls.filter(
        ([command]) => command === 'graphql_cache_collection_coverage'
      )
    ).toHaveLength(1);
    expect(
      invoke.mock.calls.filter(
        ([command]) => command === 'graphql_cache_entity_filter'
      )
    ).toHaveLength(1);
  });

  it('handles an older native predicate decoder without hiding unrelated storage errors', async () => {
    invoke.mockImplementation(async (command: string) => {
      if (command === 'graphql_cache_entity_filter')
        throw 'invalid args `request`: unknown field `collection`, expected `filters`';
      return null;
    });
    const old = createTauriCacheHost({ scope: 'old-native' });
    hosts.push(old);
    await expect(old.entityFilter(args)).resolves.toEqual({
      kind: 'unsupported',
    });
    await expect(old.collectionCoverage?.(begin)).resolves.toEqual({
      kind: 'unsupported',
    });
    expect(
      invoke.mock.calls.some(
        ([command]) => command === 'graphql_cache_collection_coverage'
      )
    ).toBe(false);
    let failing = true;
    invoke.mockImplementation(async (command: string) => {
      if (command === 'graphql_cache_collection_coverage') {
        if (failing) throw new Error('storage failed');
        return {
          kind: 'started',
          scanId: 'scan',
          revision: INITIAL_CACHE_REVISION,
        };
      }
      return null;
    });
    const current = createTauriCacheHost({ scope: 'new-native' });
    hosts.push(current);
    await expect(current.collectionCoverage?.(begin)).rejects.toThrow(
      'storage failed'
    );
    failing = false;
    await expect(current.collectionCoverage?.(begin)).resolves.toMatchObject({
      kind: 'started',
    });
  });
});
