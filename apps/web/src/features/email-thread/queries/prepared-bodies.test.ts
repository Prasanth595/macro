import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ flagOn: true }));
vi.mock('@core/constant/featureFlags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@core/constant/featureFlags')>()),
  isFeatureEnabled: () => mocks.flagOn,
}));

import { EmailThreadPageDocument } from '@service-storage/graphql/generated/graphql';
import type { Client } from '@urql/core';
import { type ArgumentNode, Kind, visit } from 'graphql';
import { createRoot, createSignal } from 'solid-js';
import {
  createPreparedBodiesFill,
  SERVER_PREPARE_VERSION,
  toServerPreparedBody,
} from './prepared-bodies';

const prepared = (version: number) => ({
  version,
  html: '<p>Hi</p>',
  hasTable: false,
  hasHiddenContent: true,
  imageProxyUrl: 'https://gateway.test/image-proxy/proxy',
  sourceLength: 9,
});

it('mounts only bodies of this client version', () => {
  expect(toServerPreparedBody(prepared(SERVER_PREPARE_VERSION))).toEqual({
    body: {
      html: '<p>Hi</p>',
      kind: 'html',
      hasTable: false,
      hasHiddenContent: true,
    },
    imageProxyUrl: 'https://gateway.test/image-proxy/proxy',
    sourceLength: 9,
  });
  expect(
    toServerPreparedBody(prepared(SERVER_PREPARE_VERSION + 1))
  ).toBeUndefined();
  expect(toServerPreparedBody(undefined)).toBeUndefined();
});

it('reads the version the thread page selects from the cache', () => {
  const versions: unknown[] = [];
  visit(EmailThreadPageDocument, {
    Field(node) {
      if (node.name.value !== 'preparedBody') return;
      const version = node.arguments?.find(
        (argument: ArgumentNode) => argument.name.value === 'version'
      )?.value;
      versions.push(version?.kind === Kind.INT ? Number(version.value) : null);
    },
  });
  expect(versions).toEqual([SERVER_PREPARE_VERSION]);
});

it('fills the cache once per thread, only while the flag is on', () => {
  const query = vi.fn((..._args: unknown[]) => ({
    toPromise: async () => ({}),
  }));
  const client = { query } as unknown as Pick<Client, 'query'>;
  const [threadId, setThreadId] = createSignal('thread');

  mocks.flagOn = false;
  createRoot((dispose) => {
    createPreparedBodiesFill(
      threadId,
      () => true,
      () => client
    );
    dispose();
  });
  expect(query).not.toHaveBeenCalled();

  mocks.flagOn = true;
  const dispose = createRoot((dispose) => {
    createPreparedBodiesFill(
      threadId,
      () => true,
      () => client
    );
    return dispose;
  });
  setThreadId('other');
  dispose();
  expect(
    query.mock.calls.map(([, variables, context]) => [variables, context])
  ).toEqual([
    [
      {
        threadId: 'thread',
        offset: 0,
        limit: 20,
        version: SERVER_PREPARE_VERSION,
      },
      { requestPolicy: 'cache-first' },
    ],
    [
      {
        threadId: 'other',
        offset: 0,
        limit: 20,
        version: SERVER_PREPARE_VERSION,
      },
      { requestPolicy: 'cache-first' },
    ],
  ]);
});
