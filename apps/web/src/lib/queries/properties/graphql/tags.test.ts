import {
  optimisticContextOf,
  withOptimisticMutationDisposition,
} from '@graphql-cache/exchange/optimistic';
import type {
  TagCatalogQuery,
  TagOptionFragment,
} from '@service-storage/graphql/generated/graphql';
import { createClient, type Operation, type OperationResult } from '@urql/core';
import { beforeEach, expect, it, vi } from 'vitest';
import { filter, fromPromise, mergeMap, pipe } from 'wonka';

const state = vi.hoisted(() => ({
  client: undefined as ReturnType<typeof createClient> | undefined,
  readRecordsByKeys: vi.fn(),
}));
vi.mock('@service-storage/graphql-soup', () => ({
  getGraphqlSoupClient: () => state.client,
  getGraphqlCacheHost: () => ({ readRecordsByKeys: state.readRecordsByKeys }),
}));

import { createGraphqlTag, updateGraphqlTag } from './tags';

const user = 'macro|viewer@macro.com';
const definitionId = '019ce2bb-e97e-7fdb-b6b4-d6b36fbe9da0';
const option: TagOptionFragment = {
  __typename: 'GraphqlPropertyOption',
  id: '019ce2bb-e97e-7fdb-b6b4-d6b36fbe9da1',
  propertyDefinitionId: definitionId,
  value: { __typename: 'GraphqlStringPropertyOptionValue', value: 'Original' },
  displayOrder: 0,
  color: '#123456',
  createdAt: '2026-10-21T00:00:00Z',
  updatedAt: '2026-10-21T00:00:00Z',
};
const catalog: TagCatalogQuery = {
  user: {
    __typename: 'GraphqlUser',
    id: user,
    tagCatalog: {
      __typename: 'GraphqlTagCatalog',
      scopes: [
        { __typename: 'GraphqlTagOwner', scope: 'USER', principalId: user },
      ],
      definitions: [
        {
          __typename: 'GraphqlPropertyDefinition',
          id: definitionId,
          owner: {
            __typename: 'GraphqlPropertyDefinitionOwner',
            scope: 'USER',
            principalId: user,
          },
          displayName: 'Tags',
          dataType: 'TAG',
          isMultiSelect: true,
          isSystem: false,
          isMetadata: false,
          specificEntityType: null,
          createdAt: option.createdAt,
          updatedAt: option.updatedAt,
          options: [option],
        },
      ],
    },
  },
};
let readCatalog: () => Promise<TagCatalogQuery | undefined>;
let writes: Operation[];
beforeEach(() => {
  writes = [];
  readCatalog = async () => catalog;
  state.readRecordsByKeys.mockReset().mockResolvedValue({
    revision: '1',
    records: [
      { recordKey: `GraphqlPropertyOption:${option.id}`, record: option },
    ],
  });
  state.client = createClient({
    url: '/tag-test',
    exchanges: [
      () => (operations) =>
        pipe(
          operations,
          filter((operation) => operation.kind !== 'teardown'),
          mergeMap((operation) =>
            fromPromise(
              (async (): Promise<OperationResult> => {
                const result = { operation, stale: false, hasNext: false };
                if (operation.kind === 'query')
                  return { ...result, data: await readCatalog() };
                writes.push(operation);
                return withOptimisticMutationDisposition(result, {
                  kind: 'queued',
                  transactionId: 'pending',
                });
              })()
            )
          )
        ),
    ],
  });
});

it('keeps a dialog editable when its local tag handle has been acknowledged', async () => {
  const localId = '22222222-2222-4222-8222-222222222222';
  const saved = await updateGraphqlTag(
    {
      propertyDefinitionId: definitionId,
      optionId: localId,
      body: { value: 'Renamed', color: '#654321' },
    },
    () => user
  );
  expect(state.readRecordsByKeys).toHaveBeenCalledWith(
    expect.objectContaining({ keys: [`GraphqlPropertyOption:${localId}`] })
  );
  expect(saved).toMatchObject({
    id: option.id,
    value: { value: 'Renamed' },
    color: '#654321',
  });
  expect(writes[0].variables?.optionId).toBe(localId);
  expect(optimisticContextOf(writes[0])?.optimisticResponse).toMatchObject({
    updateTag: { id: option.id },
  });
});

it('does not invent an empty catalog when it has never downloaded', async () => {
  readCatalog = async () => undefined;
  await expect(
    createGraphqlTag(
      { scope: 'user', value: 'Offline', color: '#123456' },
      () => user
    )
  ).rejects.toThrow('not downloaded');
  expect(writes).toHaveLength(0);
});

it('accepts an acknowledgement between the catalog and option reads', async () => {
  const localDefinition = '11111111-1111-4111-8111-111111111111';
  const localOption = '22222222-2222-4222-8222-222222222222';
  readCatalog = async () => ({
    user: {
      ...catalog.user,
      tagCatalog: {
        ...catalog.user.tagCatalog,
        definitions: catalog.user.tagCatalog.definitions.map((definition) => ({
          ...definition,
          id: localDefinition,
          options: [
            {
              ...option,
              id: localOption,
              propertyDefinitionId: localDefinition,
            },
          ],
        })),
      },
    },
  });
  state.readRecordsByKeys.mockImplementation(async () => {
    // Creation settles after the catalog snapshot, before the alias read.
    readCatalog = async () => catalog;
    return {
      revision: '2',
      records: [
        { recordKey: `GraphqlPropertyOption:${option.id}`, record: option },
      ],
    };
  });
  const saved = await updateGraphqlTag(
    {
      propertyDefinitionId: localDefinition,
      optionId: localOption,
      body: { value: 'Renamed' },
    },
    () => user
  );
  expect(saved.id).toBe(option.id);
  expect(saved.value).toEqual({ type: 'string', value: 'Renamed' });
});

it('rejects an old account catalog and an account switch during its read', async () => {
  await expect(
    createGraphqlTag(
      { scope: 'user', value: 'Offline', color: '#123456' },
      () => 'macro|other@macro.com'
    )
  ).rejects.toThrow('different account');
  let account = user;
  readCatalog = async () => {
    account = 'macro|other@macro.com';
    return catalog;
  };
  await expect(
    createGraphqlTag(
      { scope: 'user', value: 'Offline', color: '#123456' },
      () => account
    )
  ).rejects.toThrow('account change');
  expect(writes).toHaveLength(0);
});

it('enqueues only the new tag without replacing existing options', async () => {
  const created = await createGraphqlTag(
    { scope: 'user', value: 'Offline', color: '#123456' },
    () => user
  );
  expect(created.option.value).toEqual({ type: 'string', value: 'Offline' });
  const context = optimisticContextOf(writes[0]);
  expect(context?.optimisticResponse).toMatchObject({
    createTag: {
      definition: { id: definitionId },
      option: { id: created.option.id },
    },
  });
  expect(context?.optimisticResponse).not.toMatchObject({
    createTag: { definition: { options: expect.anything() } },
  });
  expect(context?.linkPatches[0].operation).toEqual({
    kind: 'prependUnique',
    entityKey: `GraphqlPropertyOption:${created.option.id}`,
  });
});
