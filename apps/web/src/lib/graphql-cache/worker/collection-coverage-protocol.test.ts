import { describe, expect, it } from 'vitest';
import { isCacheRequest } from './coordinator-protocol';

describe('collection coverage RPC validation', () => {
  it('admits only bounded, explicit document scan members', () => {
    const request = {
      id: 1,
      kind: 'collection-coverage',
      request: {
        kind: 'append',
        userId: 'viewer',
        storageGeneration: 'generation',
        scanId: 'scan',
        keys: ['GraphqlSoupDocument:a'],
      },
    };
    expect(isCacheRequest(request)).toBe(true);
    for (const replacement of [
      { keys: ['GraphqlSoupEmailThread:a'] },
      { keys: Array.from({ length: 501 }, () => 'GraphqlSoupDocument:a') },
      { keys: ['not-a-record'] },
      { scanId: '' },
      { userId: '' },
      { unexpected: true },
    ]) {
      expect(
        isCacheRequest({
          ...request,
          request: { ...request.request, ...replacement },
        })
      ).toBe(false);
    }
  });

  it('rejects ambiguous scan scopes and unscoped invalidation parameters', () => {
    const request = {
      id: 1,
      kind: 'collection-coverage',
      request: {
        kind: 'begin',
        userId: 'viewer',
        storageGeneration: 'generation',
        scope: { kind: 'documents' },
      },
    };
    expect(isCacheRequest(request)).toBe(true);
    expect(
      isCacheRequest({
        ...request,
        request: { ...request.request, scope: { kind: 'filter', filters: {} } },
      })
    ).toBe(true);
    expect(
      isCacheRequest({
        ...request,
        request: { ...request.request, scope: { kind: 'filter' } },
      })
    ).toBe(false);
    expect(
      isCacheRequest({
        ...request,
        request: {
          ...request.request,
          scope: { kind: 'documents', filters: {} },
        },
      })
    ).toBe(false);
    expect(
      isCacheRequest({
        id: 2,
        kind: 'collection-coverage',
        request: { kind: 'invalidate' },
      })
    ).toBe(true);
    expect(
      isCacheRequest({
        id: 2,
        kind: 'collection-coverage',
        request: { kind: 'invalidate', scanId: 'scan' },
      })
    ).toBe(false);
  });

  it('requires selection and rejects mixed collection, baseline, or mail reads', () => {
    const request = {
      id: 1,
      kind: 'entity-filter',
      request: {
        collection: { userId: 'viewer' },
        filters: {},
        sortMethod: 'UPDATED_AT',
        sortDirection: 'DESC',
        limit: 100,
        liveQuery: {
          id: 'view',
          document: 'fragment Row on GraphqlSoupDocument { id }',
          fragmentName: 'Row',
        },
      },
    };
    expect(isCacheRequest(request)).toBe(true);
    for (const replacement of [
      { baseline: [] },
      { mail: { view: 'ALL' } },
      { collection: { userId: '' } },
      { collection: { userId: 'viewer', scope: 'other' } },
      { liveQuery: undefined },
    ]) {
      expect(
        isCacheRequest({
          ...request,
          request: { ...request.request, ...replacement },
        })
      ).toBe(false);
    }
  });
});
