import type { EmailThreadPreparedBodiesQuery } from '@service-storage/graphql/generated/graphql';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ flagOn: true }));
vi.mock('@graphql-cache/solid/create-live-query', () => ({
  createLiveQuery: vi.fn(),
}));
vi.mock('@core/constant/featureFlags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@core/constant/featureFlags')>()),
  isFeatureEnabled: () => mocks.flagOn,
}));

import type { ServerPreparedBody } from '@app/features/email-message/context/email-rendering-context';
import { createLiveQuery } from '@graphql-cache/solid/create-live-query';
import type { Client } from '@urql/core';
import {
  createPreparedBodiesQuery,
  preparedBodiesById,
  SERVER_PREPARE_VERSION,
} from './prepared-bodies';

const prepared = (version: number) => ({
  __typename: 'GraphqlPreparedEmailBody' as const,
  version,
  html: '<p>Hi</p>',
  hasTable: false,
  hasHiddenContent: true,
  imageProxyUrl: 'https://gateway.test/image-proxy/proxy',
  sourceLength: 9,
});

it('keeps bodies of this client version, by message id', () => {
  const data = {
    user: {
      id: 'user',
      emailThread: {
        __typename: 'GraphqlSoupEmailThread',
        id: 'thread',
        messages: [
          {
            __typename: 'GraphqlSoupEmailMessage',
            id: 'a',
            preparedBody: prepared(SERVER_PREPARE_VERSION),
          },
          {
            __typename: 'GraphqlSoupEmailMessage',
            id: 'b',
            preparedBody: prepared(SERVER_PREPARE_VERSION + 1),
          },
          {
            __typename: 'GraphqlSoupEmailMessage',
            id: 'c',
            preparedBody: null,
          },
        ],
      },
    },
  } as unknown as EmailThreadPreparedBodiesQuery;
  const bodies = preparedBodiesById(data);
  expect([...bodies.keys()]).toEqual(['a']);
  expect(bodies.get('a')).toEqual({
    body: {
      html: '<p>Hi</p>',
      kind: 'html',
      hasTable: false,
      hasHiddenContent: true,
    },
    imageProxyUrl: 'https://gateway.test/image-proxy/proxy',
    sourceLength: 9,
  });
});

it('neither requests nor mounts server bodies while the flag is off', () => {
  const body = { sourceLength: 9 } as ServerPreparedBody;
  let options: { enabled: boolean } | undefined;
  vi.mocked(createLiveQuery).mockImplementation(((
    _document: unknown,
    _variables: unknown,
    readOptions: () => { enabled: boolean }
  ) => {
    options = readOptions();
    return { isSuccess: true, data: new Map([['a', body]]) };
  }) as never);
  const client = {} as Client;

  mocks.flagOn = false;
  const off = createPreparedBodiesQuery(
    () => 'thread',
    () => true,
    () => client
  );
  expect(options?.enabled).toBe(false);
  expect(off('a')).toBeUndefined();

  mocks.flagOn = true;
  expect(off('a')).toBe(body);
});
