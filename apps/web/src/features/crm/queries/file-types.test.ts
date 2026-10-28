import type { propertiesServiceClient } from '@service-properties/client';
import type { PropertyDefinitionWithOptions } from '@service-properties/generated/schemas/propertyDefinitionWithOptions';
import { waitFor } from '@solidjs/testing-library';
import { QueryClient } from '@tanstack/solid-query';
import { ok } from 'neverthrow';
import { createMemo, createRoot, createSignal, mapArray } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFileTypesSource, decodeFileTypes } from './file-types';

vi.mock('@queries/soup/cache', () => ({
  refetchSoupEntity: vi.fn(async () => {}),
}));
vi.mock('@queries/soup/crm-association', () => ({
  refreshCrmAssociatedSoupQueries: vi.fn(async () => {}),
}));

const definition: PropertyDefinitionWithOptions = {
  definition: {
    id: 'file-type',
    display_name: 'File type',
    data_type: 'SELECT_STRING',
    is_metadata: false,
    is_multi_select: false,
    specific_entity_type: null,
    is_system: false,
    owner: { scope: 'team', team_id: 'team' },
    created_at: '',
    updated_at: '',
  },
  property_options: [
    {
      id: 'contract',
      property_definition_id: 'file-type',
      display_order: 0,
      color: null,
      value: { type: 'string', value: 'Contract' },
      created_at: '',
      updated_at: '',
    },
  ],
};
const disposals: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposals.splice(0)) dispose();
});

function mount(ids: string[] = []) {
  const properties = {
    listProperties: vi
      .fn<typeof propertiesServiceClient.listProperties>()
      .mockResolvedValue(ok([definition])),
    getBulkEntityProperties: vi
      .fn<typeof propertiesServiceClient.getBulkEntityProperties>()
      .mockResolvedValue(ok({})),
    createPropertyDefinition:
      vi.fn<typeof propertiesServiceClient.createPropertyDefinition>(),
    addPropertyOption:
      vi.fn<typeof propertiesServiceClient.addPropertyOption>(),
    updatePropertyOption:
      vi.fn<typeof propertiesServiceClient.updatePropertyOption>(),
    deletePropertyOption:
      vi.fn<typeof propertiesServiceClient.deletePropertyOption>(),
    setEntityProperty:
      vi.fn<typeof propertiesServiceClient.setEntityProperty>(),
    appendCrmFileReferences:
      vi.fn<typeof propertiesServiceClient.appendCrmFileReferences>(),
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createRoot((dispose) => {
    disposals.push(() => {
      dispose();
      client.clear();
    });
    const source = createFileTypesSource(
      { properties, client },
      () => 'user',
      () => 'team',
      {
        canEdit: () => () => true,
        candidates: () => ({
          files: () => [],
          pending: () => false,
          hasMore: () => false,
          error: () => undefined,
          loadMore: async () => {},
        }),
        create: async () => 'created',
      }
    );
    return { properties, source, classes: source.classifications(() => ids) };
  });
}

describe('team file types', () => {
  it('preserves a rename draft when the catalog refreshes', async () => {
    const { properties, source } = mount();
    const rows = createRoot((dispose) => {
      disposals.push(dispose);
      return createMemo(
        mapArray(
          () => source.data()?.options ?? [],
          (option) => {
            const [draft, setDraft] = createSignal(option.name);
            return { option, draft, setDraft };
          }
        )
      );
    });
    await waitFor(() => expect(rows()).toHaveLength(1));
    const row = rows()[0];
    row.setDraft('Agreement');
    properties.listProperties.mockResolvedValue(
      ok([
        {
          ...definition,
          property_options: definition.property_options.map((option) => ({
            ...option,
            value: { type: 'string', value: 'Updated contract' },
          })),
        },
      ])
    );

    await source.refresh();

    await waitFor(() => expect(rows()[0].option.name).toBe('Updated contract'));
    expect(rows()[0]).toBe(row);
    expect(rows()[0].draft()).toBe('Agreement');
  });

  it('uses only the matching team property and rejects an incompatible definition', () => {
    expect(decodeFileTypes([definition], 'another-team')).toBeNull();
    expect(decodeFileTypes([definition], 'team')).toEqual({
      definitionId: 'file-type',
      options: [{ id: 'contract', name: 'Contract' }],
    });
    expect(() =>
      decodeFileTypes(
        [
          {
            ...definition,
            definition: { ...definition.definition, is_multi_select: true },
          },
        ],
        'team'
      )
    ).toThrow('single-select');
  });

  it('batches classification reads and distinguishes unclassified from unreadable files', async () => {
    const ids = Array.from({ length: 101 }, (_, index) => `doc-${index}`);
    const { properties, classes } = mount(ids);
    properties.getBulkEntityProperties.mockImplementation(async ({ body }) =>
      ok(
        Object.fromEntries(
          body.entities
            .filter(({ entity_id }) => entity_id !== 'doc-1')
            .map(({ entity_id }) => [entity_id, { entity_id, properties: [] }])
        )
      )
    );
    await waitFor(() => expect(classes.data()).toBeDefined());
    expect(properties.getBulkEntityProperties).toHaveBeenCalledTimes(2);
    expect(
      properties.getBulkEntityProperties.mock.calls[0][0].body.entities
    ).toHaveLength(100);
    expect(classes.data()?.get('doc-0')).toBeNull();
    expect(classes.data()?.has('doc-1')).toBe(false);
  });

  it('appends only the new record link and leaves the file type unchanged', async () => {
    const { properties, source } = mount();
    properties.appendCrmFileReferences.mockResolvedValue(ok({ success: true }));
    await source.attach('source-file', { type: 'contact', id: 'contact' });
    expect(properties.appendCrmFileReferences).toHaveBeenCalledWith({
      entity_type: 'DOCUMENT',
      entity_id: 'source-file',
      property_id: '00000001-0000-0000-0000-000000000013',
      body: {
        value: {
          type: 'multi_entity_reference',
          references: [{ entity_type: 'CONTACT', entity_id: 'contact' }],
        },
      },
    });
    expect(properties.setEntityProperty).not.toHaveBeenCalled();
  });
});
