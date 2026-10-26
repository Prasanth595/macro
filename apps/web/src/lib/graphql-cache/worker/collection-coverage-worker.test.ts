import { describe, expect, it, vi } from 'vitest';
import { parseCacheRevision } from '../protocol';
import { CacheWorkerCore } from './worker-core';

const loadWasm = vi.hoisted(() => vi.fn());
vi.mock('./wasm-module', () => ({ loadCacheWasm: loadWasm }));

describe('collection coverage worker ordering', () => {
  it('never publishes coverage ahead of queued hydration and notifies readers after publication', async () => {
    let readStarted!: () => void;
    let hydrateStarted!: () => void;
    let releaseRead!: () => void;
    let releaseHydration!: () => void;
    const reading = new Promise<void>((resolve) => {
      readStarted = resolve;
    });
    const hydrating = new Promise<void>((resolve) => {
      hydrateStarted = resolve;
    });
    const blockedRead = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const blockedHydration = new Promise<void>((resolve) => {
      releaseHydration = resolve;
    });
    const events: string[] = [];
    const effects = {
      changed: [],
      affectedOps: [],
      reset: false,
      revisionAdvanced: true,
    };
    const collectionCoverage = vi.fn(async () => {
      events.push('coverage');
      return {
        ...effects,
        kind: 'committed',
        revision: parseCacheRevision('2'),
      };
    });
    loadWasm.mockResolvedValue({
      openCache: async () => ({
        readQuery: async () => {
          events.push('read');
          readStarted();
          await blockedRead;
          return { kind: 'miss' };
        },
        hydrateQuery: async () => {
          events.push('hydrate');
          hydrateStarted();
          await blockedHydration;
          return { ...effects, revision: parseCacheRevision('1'), data: null };
        },
        collectionCoverage,
      }),
    });
    const messages: unknown[] = [];
    const port = { postMessage: (message: unknown) => messages.push(message) };
    const core = new CacheWorkerCore();
    core.addPort(port);
    await core.handleRequest(port, { id: 1, kind: 'init', scope: 'scope' });
    const read = core.handleRequest(port, {
      id: 2,
      kind: 'read',
      query: '{ user { id } }',
    });
    await reading;
    const hydration = core.handleRequest(port, {
      id: 3,
      kind: 'hydrate',
      query: '{ user { id } }',
      data: { user: { id: 'viewer' } },
    });
    const publication = core.handleRequest(port, {
      id: 4,
      kind: 'collection-coverage',
      request: {
        kind: 'complete',
        userId: 'viewer',
        storageGeneration: 'generation',
        scanId: 'scan',
      },
    });
    releaseRead();
    await hydrating;
    expect(collectionCoverage).not.toHaveBeenCalled();
    releaseHydration();
    await Promise.all([read, hydration, publication]);
    expect(events).toEqual(['read', 'hydrate', 'coverage']);
    expect(messages).toContainEqual({
      id: 4,
      ok: true,
      result: { kind: 'committed', revision: parseCacheRevision('2') },
    });
    expect(messages).toContainEqual({
      kind: 'cache-changed',
      revision: parseCacheRevision('2'),
    });
    expect(messages).not.toContainEqual(expect.objectContaining({ ok: false }));
  });
});
