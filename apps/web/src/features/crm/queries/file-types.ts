import { catchToResult, throwOnErr } from '@core/util/result';
import { Telemetry } from '@macro-inc/observability';
import { SYSTEM_PROPERTY_IDS } from '@property/constants';
import { queryReadyGate } from '@queries/gate';
import {
  invalidateAllPropertyReads,
  invalidateEntityPropertyReads,
} from '@queries/properties/invalidation';
import { propertiesKeys } from '@queries/properties/keys';
import { refetchSoupEntity } from '@queries/soup/cache';
import { refreshCrmAssociatedSoupQueries } from '@queries/soup/crm-association';
import type { propertiesServiceClient } from '@service-properties/client';
import type { PropertyDefinitionResponse } from '@service-properties/generated/schemas/propertyDefinitionResponse';
import { type QueryClient, useQuery } from '@tanstack/solid-query';
import type { Accessor } from 'solid-js';
import type { FileTypesSource } from '../context/file-types';
import {
  DEFAULT_FILE_TYPES,
  FILE_TYPE_PROPERTY_NAME,
  type FileClassification,
  type FileTypeCatalog,
} from '../core/file-types';

type Dependencies = {
  properties: Pick<
    typeof propertiesServiceClient,
    | 'listProperties'
    | 'getBulkEntityProperties'
    | 'createPropertyDefinition'
    | 'addPropertyOption'
    | 'updatePropertyOption'
    | 'deletePropertyOption'
    | 'setEntityProperty'
    | 'appendCrmFileReferences'
  >;
  client: QueryClient;
};

export function decodeFileTypes(
  definitions: PropertyDefinitionResponse[],
  teamId: string
): FileTypeCatalog | null {
  const match = definitions.find((entry) => {
    const definition = 'definition' in entry ? entry.definition : entry;
    return (
      definition.display_name === FILE_TYPE_PROPERTY_NAME &&
      definition.owner.scope === 'team' &&
      definition.owner.team_id === teamId
    );
  });
  if (!match) return null;
  if (
    !('definition' in match) ||
    match.definition.data_type !== 'SELECT_STRING' ||
    match.definition.is_multi_select
  ) {
    throw new Error(
      'The team’s File type property must be a single-select text property.'
    );
  }
  return {
    definitionId: match.definition.id,
    options: [...match.property_options]
      .sort((a, b) => a.display_order - b.display_order)
      .flatMap((option) =>
        option.value.type === 'string'
          ? [{ id: option.id, name: option.value.value }]
          : []
      ),
  };
}

function catalogOptions(
  deps: Dependencies,
  userId: string | undefined,
  teamId: string | undefined
) {
  return {
    queryKey: [
      ...propertiesKeys.definitions({ scope: 'team', includeOptions: true })
        .queryKey,
      userId,
      teamId,
    ],
    enabled: !!userId && !!teamId,
    queryFn: async () =>
      decodeFileTypes(
        await throwOnErr(() =>
          deps.properties.listProperties({
            scope: 'team',
            include_options: true,
          })
        ),
        teamId ?? ''
      ),
    staleTime: 0,
    refetchInterval: 30_000,
  };
}

function classificationOptions(
  deps: Dependencies,
  userId: string | undefined,
  catalog: FileTypeCatalog | null | undefined,
  ids: string[]
) {
  return {
    queryKey: propertiesKeys.entityBatch({
      userId,
      entityType: 'DOCUMENT',
      propertyIds: catalog ? [catalog.definitionId] : [],
      entityIds: ids,
    }).queryKey,
    enabled: !!userId && catalog !== undefined && ids.length > 0,
    queryFn: async () => {
      const result = new Map<string, FileClassification>();
      if (!catalog) return new Map(ids.map((id) => [id, null]));
      for (let offset = 0; offset < ids.length; offset += 100) {
        const page = await throwOnErr(() =>
          deps.properties.getBulkEntityProperties({
            body: {
              entities: ids
                .slice(offset, offset + 100)
                .map((entity_id) => ({ entity_id, entity_type: 'DOCUMENT' })),
              property_ids: [catalog.definitionId],
            },
          })
        );
        for (const [id, entity] of Object.entries(page)) {
          const value = entity.properties.find(
            (property) => property.definition.id === catalog.definitionId
          )?.value;
          result.set(
            id,
            value?.type === 'SelectOption' ? (value.value[0] ?? null) : null
          );
        }
      }
      return result;
    },
    staleTime: 0,
    refetchInterval: 30_000,
  };
}

export function createFileTypesSource(
  deps: Dependencies,
  userId: Accessor<string | undefined>,
  teamId: Accessor<string | undefined>,
  host: Pick<FileTypesSource, 'candidates' | 'canEdit' | 'create'>
): FileTypesSource {
  const sessionKey = () =>
    userId() && teamId() ? `${userId()}:${teamId()}` : undefined;
  const catalog = useQuery(
    () => catalogOptions(deps, userId(), teamId()),
    () => deps.client
  );
  const data = () => (queryReadyGate(catalog) ? catalog.data : undefined);
  const requireCatalog = () => {
    const value = data();
    if (!value) throw new Error('Set up file types first.');
    return value;
  };
  const refreshTypes = () => invalidateAllPropertyReads(deps.client);
  async function refreshFile(id: string) {
    await Promise.all([
      invalidateEntityPropertyReads(deps.client, 'DOCUMENT', id),
      refetchSoupEntity(id, 'document', { refreshGraphql: true }),
      refreshCrmAssociatedSoupQueries(),
    ]);
  }
  return {
    ...host,
    sessionKey,
    data,
    pending: () => catalog.isPending,
    error: () => catalog.isError,
    refresh: () => catalog.refetch(),
    canManage: () => !!userId() && !!teamId(),
    async initialize() {
      const session = sessionKey();
      const owner = teamId();
      if (!owner) throw new Error('Join a team to manage file types.');
      const existing = await deps.client.fetchQuery(
        catalogOptions(deps, userId(), owner)
      );
      if (!session || session !== sessionKey())
        throw new Error('The signed-in user or team changed.');
      if (existing) return;
      const created = await deps.properties.createPropertyDefinition({
        body: {
          scope: 'team',
          display_name: FILE_TYPE_PROPERTY_NAME,
          data_type: {
            type: 'select_string',
            multi: false,
            options: DEFAULT_FILE_TYPES.map((value, display_order) => ({
              value,
              display_order,
            })),
          },
        },
      });
      // A concurrent setup may have won the team's unique property-name constraint.
      if (created.isErr()) {
        const current = await deps.client.fetchQuery(
          catalogOptions(deps, userId(), owner)
        );
        if (!current) await throwOnErr(() => Promise.resolve(created));
      }
      await refreshTypes();
    },
    async add(name) {
      const current = requireCatalog();
      await throwOnErr(() =>
        deps.properties.addPropertyOption({
          definition_id: current.definitionId,
          body: {
            type: 'select_string',
            option: { value: name, display_order: current.options.length },
          },
        })
      );
      await refreshTypes();
    },
    async rename(optionId, name) {
      const current = requireCatalog();
      await throwOnErr(() =>
        deps.properties.updatePropertyOption({
          definition_id: current.definitionId,
          option_id: optionId,
          body: { value: name },
        })
      );
      await refreshTypes();
    },
    async remove(optionId) {
      const current = requireCatalog();
      await throwOnErr(() =>
        deps.properties.deletePropertyOption({
          definition_id: current.definitionId,
          option_id: optionId,
        })
      );
      await Promise.all([
        refreshTypes(),
        deps.client.invalidateQueries({
          queryKey: propertiesKeys.entityBatch._def,
        }),
      ]);
    },
    async classify(documentId, optionId) {
      const current = requireCatalog();
      if (optionId && !current.options.some((option) => option.id === optionId))
        throw new Error('This file type no longer exists.');
      await Telemetry.span('crm.file.classify', async (span) => {
        span.setAttr('document.id', documentId);
        await throwOnErr(() =>
          deps.properties.setEntityProperty({
            entity_type: 'DOCUMENT',
            entity_id: documentId,
            property_id: current.definitionId,
            body: {
              value: optionId
                ? { type: 'select_option', option_id: optionId }
                : null,
            },
          })
        );
        // A refresh failure must never turn a committed classification into a failed write.
        const refreshed = await catchToResult(() => refreshFile(documentId));
        if (refreshed.isErr())
          span.error('File classification saved; refresh failed');
      });
    },
    classifications(ids) {
      const query = useQuery(
        () => classificationOptions(deps, userId(), data(), ids()),
        () => deps.client
      );
      return {
        data: () => (queryReadyGate(query) ? query.data : undefined),
        pending: () => query.isPending && ids().length > 0,
        error: () => query.isError,
        refresh: () => query.refetch(),
      };
    },
    async attach(documentId, record) {
      await Telemetry.span('crm.file.attach', async (span) => {
        span.setAttr('document.id', documentId);
        span.setAttr('crm.record.id', record.id);
        const propertyId =
          record.type === 'company'
            ? SYSTEM_PROPERTY_IDS.COMPANIES
            : SYSTEM_PROPERTY_IDS.CONTACTS;
        const entityType = record.type === 'company' ? 'COMPANY' : 'CONTACT';
        await throwOnErr(() =>
          deps.properties.appendCrmFileReferences({
            entity_type: 'DOCUMENT',
            entity_id: documentId,
            property_id: propertyId,
            body: {
              value: {
                type: 'multi_entity_reference',
                references: [{ entity_id: record.id, entity_type: entityType }],
              },
            },
          })
        );
        const refreshed = await catchToResult(() => refreshFile(documentId));
        if (refreshed.isErr()) span.error('File attached; refresh failed');
      });
    },
  };
}
