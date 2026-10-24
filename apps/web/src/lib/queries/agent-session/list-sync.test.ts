import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rest: vi.fn<
    (ids?: string[], options?: { throwOnError?: boolean }) => Promise<void>
  >(async () => {}),
  graphql: vi.fn<(options?: { throwOnError?: boolean }) => Promise<void>>(
    async () => {}
  ),
  graphqlSoup: vi.fn(() => false),
  row: vi.fn<
    (
      document: unknown,
      variables: { sessionId: string },
      context: { requestPolicy: string }
    ) => Promise<{ error?: Error }>
  >(async () => ({})),
}));

vi.mock('@queries/soup/refresh', () => ({
  refreshSoupEntities: mocks.rest,
}));
vi.mock('@queries/soup/graphql/active-queries', () => ({
  refreshActiveGraphqlSoupQueries: mocks.graphql,
}));
vi.mock('@core/constant/featureFlags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@core/constant/featureFlags')>()),
  isFeatureEnabled: mocks.graphqlSoup,
}));
vi.mock('@service-storage/graphql-soup', () => ({
  getGraphqlSoupClient: () => ({
    query: (
      document: unknown,
      variables: { sessionId: string },
      context: { requestPolicy: string }
    ) => ({ toPromise: () => mocks.row(document, variables, context) }),
  }),
}));
vi.mock('@queries/client', async () => {
  const { QueryClient } = await import('@tanstack/query-core');
  return { queryClient: new QueryClient() };
});

import { AgentSessionRowDocument } from '@service-storage/graphql/generated/graphql';
import { refreshAgentSessionLists } from './list-sync';
import { invalidateAgentSessionMetadata } from './session-metadata-sync';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.graphqlSoup.mockReturnValue(false);
});
afterEach(() => vi.restoreAllMocks());

it('coalesces a metadata burst into one REST list refresh', async () => {
  await Promise.all([
    refreshAgentSessionLists('first'),
    refreshAgentSessionLists('first'),
    refreshAgentSessionLists('second'),
  ]);
  expect(mocks.rest.mock.calls).toEqual([
    [['first', 'second'], { throwOnError: true }],
  ]);
});

it('never network-refreshes the GraphQL soup queries', async () => {
  await refreshAgentSessionLists('first');
  expect(mocks.graphql).not.toHaveBeenCalled();
});

it('re-reads each changed session row from the network under GraphQL Soup', async () => {
  mocks.graphqlSoup.mockReturnValue(true);
  await Promise.all([
    refreshAgentSessionLists('first'),
    refreshAgentSessionLists('first'),
    refreshAgentSessionLists('second'),
  ]);
  expect(mocks.row.mock.calls).toEqual([
    [
      AgentSessionRowDocument,
      { sessionId: 'first' },
      { requestPolicy: 'network-only' },
    ],
    [
      AgentSessionRowDocument,
      { sessionId: 'second' },
      { requestPolicy: 'network-only' },
    ],
  ]);
  expect(mocks.graphql).not.toHaveBeenCalled();
});

it('reads no GraphQL row while lists are on REST', async () => {
  await refreshAgentSessionLists('first');
  expect(mocks.row).not.toHaveBeenCalled();
});

it('retries a session whose row read failed', async () => {
  mocks.graphqlSoup.mockReturnValue(true);
  mocks.row.mockResolvedValueOnce({ error: new Error('network') });
  await refreshAgentSessionLists('first');
  expect(mocks.row.mock.calls.map(([, variables]) => variables)).toEqual([
    { sessionId: 'first' },
    { sessionId: 'first' },
  ]);
});

it('leaves soup lists alone when the gateway socket opens', async () => {
  await invalidateAgentSessionMetadata();
  expect(mocks.rest).not.toHaveBeenCalled();
});

it('does not lose metadata committed while a refresh is in flight', async () => {
  let release!: () => void;
  mocks.rest.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      })
  );
  const first = refreshAgentSessionLists('first');
  await Promise.resolve();
  const second = refreshAgentSessionLists('second');
  release();
  await Promise.all([first, second]);
  expect(mocks.rest.mock.calls).toEqual([
    [['first'], { throwOnError: true }],
    [['second'], { throwOnError: true }],
  ]);
});

it('retries a failed batch together with updates queued while it was in flight', async () => {
  let fail!: (error: Error) => void;
  mocks.rest.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, reject) => {
        fail = reject;
      })
  );
  const first = refreshAgentSessionLists('first');
  await Promise.resolve();
  const second = refreshAgentSessionLists('second');
  fail(new Error('temporary outage'));
  await Promise.all([first, second]);

  expect(mocks.rest.mock.calls.map(([ids]) => ids)).toEqual([
    ['first'],
    ['second', 'first'],
  ]);
});

it('retains failed IDs after a bounded retry for the next refresh', async () => {
  const error = new Error('offline');
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.rest.mockRejectedValueOnce(error).mockRejectedValueOnce(error);
  await expect(refreshAgentSessionLists('failed')).resolves.toBeUndefined();
  expect(mocks.rest).toHaveBeenCalledTimes(2);
  expect(logged).toHaveBeenCalledExactlyOnceWith(
    '[agent-session] failed to refresh session lists',
    error
  );

  await refreshAgentSessionLists('next');
  expect(mocks.rest.mock.calls.map(([ids]) => ids)).toEqual([
    ['failed'],
    ['failed'],
    ['failed', 'next'],
  ]);
});
