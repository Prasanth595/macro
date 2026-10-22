/** Tag metadata and lifecycle use the same durable queue as entity assignments. */
import {
  executeOptimisticMutation,
  type OptimisticMutationOptions,
  type OptimisticResponse,
  optimisticMutationDispositionOf,
  prependUnique,
  remove,
  selectRecord,
  update,
} from '@graphql-cache/exchange/optimistic';
import { readRecordsByKeys, selectRecords } from '@graphql-cache/index';
import type { IdentityBindingWire } from '@graphql-cache/protocol';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { Telemetry } from '@macro-inc/observability';
import type { TagScope } from '@service-properties/generated/schemas/tagScope';
import type { UpdatePropertyOptionRequest } from '@service-properties/generated/schemas/updatePropertyOptionRequest';
import {
  CreateTagDocument,
  DeleteTagDocument,
  EnsureTagSetDocument,
  TagCatalogOwnerFragmentDoc,
  type TagDefinitionFragment,
  TagDefinitionFragmentDoc,
  type TagOptionFragment,
  TagOptionFragmentDoc,
  UpdateTagDocument,
} from '@service-storage/graphql/generated/graphql';
import {
  getGraphqlCacheHost,
  getGraphqlSoupClient,
} from '@service-storage/graphql-soup';
import type { AnyVariables } from '@urql/core';
import type { Accessor } from 'solid-js';
import { cachedTagCatalog, tagOption, tagSet } from './tag-catalog';

const definitionKey = (id: string) => `GraphqlPropertyDefinition:${id}`;
const optionKey = (id: string) => `GraphqlPropertyOption:${id}`;

export function tagDefinitionBinding(
  id: string,
  responsePath: string[] = []
): IdentityBindingWire {
  return {
    localKey: definitionKey(id),
    responsePath,
    referenceFields: [
      'GraphqlPropertyOption.propertyDefinitionId',
      'GraphqlProperty.propertyDefinitionId',
    ],
  };
}
export function tagOptionBinding(
  id: string,
  responsePath: string[] = []
): IdentityBindingWire {
  return {
    localKey: optionKey(id),
    responsePath,
    referenceFields: ['GraphqlSelectOptionPropertyValue.optionIds'],
  };
}

type TagActor = { id: string; assertCurrent: () => void };
function captureActor(currentId: Accessor<string | undefined>): TagActor {
  const id = currentId();
  if (!id) throw new Error('Sign in before changing tags');
  return {
    id,
    assertCurrent: () => {
      if (currentId() !== id)
        throw new Error('Tag save interrupted by an account change');
    },
  };
}
async function actorCatalog(actor: TagActor) {
  const data = await cachedTagCatalog();
  actor.assertCurrent();
  if (data.user.id !== actor.id)
    throw new Error('Tag catalog belongs to a different account');
  return data;
}

async function submit<Data, Vars extends AnyVariables>(
  document: TypedDocumentNode<Data, Vars>,
  variables: Vars,
  optimistic: OptimisticResponse<Data>,
  options: OptimisticMutationOptions,
  actor: TagActor
): Promise<Data | undefined> {
  return Telemetry.span('tags.enqueue', async (span) => {
    span.setAttr('mutation.uuid', options.uuid);
    try {
      actor.assertCurrent();
      const result = await executeOptimisticMutation(
        getGraphqlSoupClient(),
        document,
        variables,
        optimistic,
        options
      ).toPromise();
      actor.assertCurrent();
      const disposition = optimisticMutationDispositionOf<Data, Vars>(result);
      if (disposition?.kind === 'queued') {
        span.setAttr('tag.outcome', 'queued');
        return undefined;
      }
      if (disposition?.kind === 'permanently-failed') throw disposition.error;
      if (result.error) throw result.error;
      const data =
        disposition?.kind === 'committed' ? disposition.data : result.data;
      if (!data) throw new Error('Tag mutation returned no data');
      span.setAttr('tag.outcome', 'committed');
      return data;
    } catch (error) {
      span.error('Tag operation failed');
      throw error;
    }
  });
}

// Only coalesce concurrent provisioning while enqueue is in flight. The catalog,
// including the pending definition, is the durable identity source after restart.
const provisioning = new Map<string, Promise<TagDefinitionFragment>>();

async function ensureDefinition(
  scope: TagScope,
  actor: TagActor
): Promise<TagDefinitionFragment> {
  return Telemetry.span('tags.provision', async (span) => {
    span.setAttr('tag.scope', scope);
    try {
      const catalog = await actorCatalog(actor);
      const graphqlScope = scope === 'user' ? 'USER' : 'TEAM';
      const owner = catalog.user.tagCatalog.scopes.find(
        (owner) => owner.scope === graphqlScope
      );
      if (!owner) throw new Error('This tag scope is unavailable');
      const existing = catalog.user.tagCatalog.definitions.find(
        (definition) =>
          definition.owner.scope === graphqlScope &&
          definition.owner.principalId === owner.principalId
      );
      if (existing) {
        span.setAttr('tag.definition_id', existing.id);
        span.setAttr('tag.catalog_hit', true);
        return existing;
      }
      const key = `${catalog.user.id}:${owner.principalId}:${scope}`;
      const pending = provisioning.get(key);
      if (pending) return pending;
      const provision = async (): Promise<TagDefinitionFragment> => {
        const id = crypto.randomUUID();
        span.setAttr('tag.definition_id', id);
        span.setAttr('tag.catalog_hit', false);
        const now = new Date().toISOString();
        const definition: TagDefinitionFragment = {
          __typename: 'GraphqlPropertyDefinition',
          id,
          owner: {
            __typename: 'GraphqlPropertyDefinitionOwner',
            scope: graphqlScope,
            principalId: owner.principalId,
          },
          displayName: 'Tags',
          dataType: 'TAG',
          isMultiSelect: true,
          isSystem: false,
          isMetadata: false,
          specificEntityType: null,
          createdAt: now,
          updatedAt: now,
          options: [],
        };
        const result = await submit(
          EnsureTagSetDocument,
          {
            scope: graphqlScope,
            teamId: scope === 'team' ? owner.principalId : null,
            clientDefinitionId: id,
          },
          { ensureTagSet: definition },
          {
            uuid: crypto.randomUUID(),
            identityBindings: [tagDefinitionBinding(id, ['ensureTagSet'])],
            updates: [
              update(
                selectRecord(TagCatalogOwnerFragmentDoc, {
                  __typename: 'GraphqlUser',
                  id: catalog.user.id,
                })
                  .field('tagCatalog')
                  .field('definitions'),
                prependUnique({ __typename: 'GraphqlPropertyDefinition', id })
              ),
            ],
          },
          actor
        );
        return result?.ensureTagSet ?? definition;
      };
      const result = provision();
      provisioning.set(key, result);
      try {
        return await result;
      } finally {
        if (provisioning.get(key) === result) provisioning.delete(key);
      }
    } catch (error) {
      span.error('Tag operation failed');
      throw error;
    }
  });
}

export async function ensureGraphqlTagSet(
  scope: TagScope,
  currentId: Accessor<string | undefined>
) {
  return Telemetry.span('tags.ensure', async (span) => {
    span.setAttr('tag.scope', scope);
    try {
      return tagSet(await ensureDefinition(scope, captureActor(currentId)));
    } catch (error) {
      span.error('Tag operation failed');
      throw error;
    }
  });
}

export async function createGraphqlTag(
  input: { scope: TagScope; value: string; color?: string },
  currentId: Accessor<string | undefined>
) {
  return Telemetry.span('tags.create', async (span) => {
    span.setAttr('tag.scope', input.scope);
    try {
      const actor = captureActor(currentId);
      const definition = await ensureDefinition(input.scope, actor);
      const id = crypto.randomUUID();
      span.setAttr('tag.definition_id', definition.id);
      span.setAttr('tag.option_id', id);
      const now = new Date().toISOString();
      const option: TagOptionFragment = {
        __typename: 'GraphqlPropertyOption',
        id,
        propertyDefinitionId: definition.id,
        displayOrder: 0,
        value: {
          __typename: 'GraphqlStringPropertyOptionValue',
          value: input.value,
        },
        color: input.color ?? null,
        createdAt: now,
        updatedAt: now,
      };
      const { options: _options, ...definitionFields } = definition;
      const result = await submit(
        CreateTagDocument,
        {
          input: {
            scope: input.scope === 'user' ? 'USER' : 'TEAM',
            teamId:
              input.scope === 'team' ? definition.owner.principalId : null,
            clientDefinitionId: definition.id,
            clientOptionId: id,
            value: input.value,
            color: input.color,
          },
        },
        {
          createTag: {
            __typename: 'GraphqlCreatedTag',
            definition: definitionFields,
            option,
          },
        },
        {
          uuid: crypto.randomUUID(),
          identityBindings: [
            tagDefinitionBinding(definition.id, ['createTag', 'definition']),
            tagOptionBinding(id, ['createTag', 'option']),
          ],
          updates: [
            update(
              selectRecord(TagDefinitionFragmentDoc, {
                __typename: 'GraphqlPropertyDefinition',
                id: definition.id,
              }).field('options'),
              prependUnique({ __typename: 'GraphqlPropertyOption', id })
            ),
          ],
        },
        actor
      );
      return {
        scope: input.scope,
        tagSet: tagSet(
          result?.createTag.definition ?? {
            ...definition,
            options: [...definition.options, option],
          }
        ),
        option: tagOption(result?.createTag.option ?? option),
      };
    } catch (error) {
      span.error('Tag operation failed');
      throw error;
    }
  });
}

export async function updateGraphqlTag(
  input: {
    propertyDefinitionId: string;
    optionId: string;
    body: UpdatePropertyOptionRequest;
  },
  currentId: Accessor<string | undefined>
) {
  return Telemetry.span('tags.update', async (span) => {
    span.setAttr('tag.definition_id', input.propertyDefinitionId);
    span.setAttr('tag.option_id', input.optionId);
    try {
      const actor = captureActor(currentId);
      const catalog = await actorCatalog(actor);
      // A dialog may still hold the local handle when create is acknowledged.
      // Explicit record reads follow its durable alias to the committed identity.
      const host = getGraphqlCacheHost();
      if (!host) throw new Error('Tag cache is unavailable');
      const selected = await readRecordsByKeys(
        host,
        selectRecords(TagOptionFragmentDoc),
        [optionKey(input.optionId)]
      );
      actor.assertCurrent();
      const resolved = selected.records[0]?.record;
      const definition = catalog.user.tagCatalog.definitions.find(
        (d) =>
          d.id === input.propertyDefinitionId ||
          d.id === resolved?.propertyDefinitionId
      );
      // The acknowledgement may land between these reads. The catalog can still
      // contain the dialog's original handle while the explicit read follows its
      // alias; accept that membership and patch the newer canonical record.
      const option = definition?.options.some(
        (o) => o.id === input.optionId || o.id === resolved?.id
      )
        ? resolved
        : undefined;
      if (!option) throw new Error('Tag is not available on this device');
      const optimistic: TagOptionFragment = {
        ...option,
        ...(input.body.value != null
          ? {
              value: {
                __typename: 'GraphqlStringPropertyOptionValue',
                value: input.body.value,
              } as const,
            }
          : {}),
        color: input.body.color ?? option.color,
      };
      const result = await submit(
        UpdateTagDocument,
        {
          propertyDefinitionId: input.propertyDefinitionId,
          optionId: input.optionId,
          input: { value: input.body.value, color: input.body.color },
        },
        { updateTag: optimistic },
        {
          uuid: crypto.randomUUID(),
          identityBindings: [
            tagDefinitionBinding(input.propertyDefinitionId),
            tagOptionBinding(input.optionId),
          ],
        },
        actor
      );
      return tagOption(result?.updateTag ?? optimistic);
    } catch (error) {
      span.error('Tag operation failed');
      throw error;
    }
  });
}

export async function deleteGraphqlTag(
  input: { propertyDefinitionId: string; optionId: string },
  currentId: Accessor<string | undefined>
) {
  return Telemetry.span('tags.delete', async (span) => {
    span.setAttr('tag.definition_id', input.propertyDefinitionId);
    span.setAttr('tag.option_id', input.optionId);
    try {
      const actor = captureActor(currentId);
      await actorCatalog(actor);
      await submit(
        DeleteTagDocument,
        input,
        {
          deleteTag: {
            graphqlTypeName: 'GraphqlPropertyOption',
            entityId: input.optionId,
          },
        },
        {
          uuid: crypto.randomUUID(),
          identityBindings: [
            tagDefinitionBinding(input.propertyDefinitionId),
            { ...tagOptionBinding(input.optionId), deleteRecord: true },
          ],
          updates: [
            update(
              selectRecord(TagDefinitionFragmentDoc, {
                __typename: 'GraphqlPropertyDefinition',
                id: input.propertyDefinitionId,
              }).field('options'),
              remove({
                __typename: 'GraphqlPropertyOption',
                id: input.optionId,
              })
            ),
          ],
        },
        actor
      );
      return { success: true };
    } catch (error) {
      span.error('Tag operation failed');
      throw error;
    }
  });
}
