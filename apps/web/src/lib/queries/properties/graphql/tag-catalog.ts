import { createLiveQuery } from '@graphql-cache/solid/create-live-query';
import type { PropertyOption } from '@service-properties/generated/schemas/propertyOption';
import type { TagSetResponse } from '@service-properties/generated/schemas/tagSetResponse';
import {
  TagCatalogDocument,
  type TagCatalogQuery,
  type TagDefinitionFragment,
  type TagOptionFragment,
} from '@service-storage/graphql/generated/graphql';
import { getGraphqlSoupClient } from '@service-storage/graphql-soup';
import type { Accessor } from 'solid-js';

export function tagOption(option: TagOptionFragment): PropertyOption {
  if (option.value.__typename !== 'GraphqlStringPropertyOptionValue')
    throw new Error('Tag has a non-text value');
  return {
    id: option.id,
    property_definition_id: option.propertyDefinitionId,
    display_order: option.displayOrder,
    color: option.color,
    created_at: option.createdAt,
    updated_at: option.updatedAt,
    value: { type: 'string', value: option.value.value },
  };
}

export function tagSet(definition: TagDefinitionFragment): TagSetResponse {
  const owner = definition.owner;
  if (
    !owner.principalId ||
    (owner.scope !== 'USER' && owner.scope !== 'TEAM')
  ) {
    throw new Error('Tag definition has no personal or team owner');
  }
  return {
    scope: owner.scope === 'USER' ? 'user' : 'team',
    definition: {
      ...(owner.scope === 'USER'
        ? { scope: 'user' as const, user_id: owner.principalId }
        : { scope: 'team' as const, team_id: owner.principalId }),
      id: definition.id,
      displayName: definition.displayName,
      dataType: 'TAG',
      isMultiSelect: definition.isMultiSelect,
      isSystem: definition.isSystem,
      isMetadata: definition.isMetadata,
      specificEntityType: null,
      createdAt: definition.createdAt,
      updatedAt: definition.updatedAt,
    },
    options: definition.options.map((option) => ({
      id: option.id,
      propertyDefinitionId: option.propertyDefinitionId,
      displayOrder: option.displayOrder,
      color: option.color,
      value: tagOption(option).value,
    })),
  };
}

export function tagSets(data: TagCatalogQuery): TagSetResponse[] {
  return data.user.tagCatalog.scopes.map((owner) => {
    const definition = data.user.tagCatalog.definitions.find(
      (definition) =>
        definition.owner.scope === owner.scope &&
        definition.owner.principalId === owner.principalId
    );
    return definition
      ? tagSet(definition)
      : {
          scope: owner.scope === 'USER' ? 'user' : 'team',
          definition: null,
          options: [],
        };
  });
}

/** Start with backfill; the normalized cache persists this catalog per account. */
export function useGraphqlTagCatalog(enabled: Accessor<boolean>) {
  return createLiveQuery(
    TagCatalogDocument,
    () => (enabled() ? {} : undefined),
    () => ({
      client: getGraphqlSoupClient(),
      requestPolicy: 'cache-and-network' as const,
    })
  );
}

export async function cachedTagCatalog(): Promise<TagCatalogQuery> {
  const result = await getGraphqlSoupClient()
    .query(TagCatalogDocument, {}, { requestPolicy: 'cache-only' })
    .toPromise();
  if (!result.data)
    throw new Error('Tags have not downloaded to this device yet');
  return result.data;
}
