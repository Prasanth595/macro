import '@app/index.css';
import { AnalyticsContextProvider } from '@app/lib/analytics/analytics-context';
import { PosthogProvider } from '@app/lib/analytics/posthog';
import { setGlobalSplitManager } from '@app/signal/splitLayout';
import { ItemDndProvider } from '@components/app/ItemDragAndDrop';
import { createRoutedSplitLayout } from '@components/app/split-layout/tests/fixtures';
import { EmailLinksContextProvider } from '@core/context/emailLinks';
import { UserContextProvider } from '@core/context/user';
import { createBlockOrchestrator } from '@core/orchestrator';
import { type EntityData, ListEntity, ListLayoutProvider } from '@entity';
import { ListEntityNoopMetadataProvider } from '@entity/composed/list-entity/list-entity-metadata-provider';
import { PROPERTY_OPTION_IDS, SYSTEM_PROPERTY_IDS } from '@property/constants';
import { previewKeys } from '@queries/preview/keys';
import type { PreviewItem } from '@queries/preview/types';
import type { SoupProperty } from '@service-storage/generated/schemas/soupProperty';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { createSignal, For } from 'solid-js';
import { render } from 'solid-js/web';

const createdAt = '2026-10-01T12:00:00Z';
const common = { ownerId: '', createdAt, updatedAt: createdAt };
const properties: SoupProperty[] = [
  {
    id: 'status-property',
    definition: {
      id: SYSTEM_PROPERTY_IDS.STATUS,
      display_name: 'Status',
      data_type: 'SELECT_STRING',
      is_metadata: false,
      is_multi_select: false,
      is_system: true,
      owner: { scope: 'system' },
      specific_entity_type: null,
      created_at: createdAt,
      updated_at: createdAt,
    },
    value: {
      type: 'SelectOption',
      value: [PROPERTY_OPTION_IDS.STATUS.IN_PROGRESS],
    },
  },
  {
    id: 'companies-property',
    definition: {
      id: SYSTEM_PROPERTY_IDS.COMPANIES,
      display_name: 'Companies',
      data_type: 'ENTITY',
      is_metadata: false,
      is_multi_select: true,
      is_system: true,
      owner: { scope: 'system' },
      specific_entity_type: 'COMPANY',
      created_at: createdAt,
      updated_at: createdAt,
    },
    value: {
      type: 'EntityReference',
      value: [{ entity_type: 'COMPANY', entity_id: 'company' }],
    },
  },
  {
    id: 'contacts-property',
    definition: {
      id: SYSTEM_PROPERTY_IDS.CONTACTS,
      display_name: 'Contacts',
      data_type: 'ENTITY',
      is_metadata: false,
      is_multi_select: true,
      is_system: true,
      owner: { scope: 'system' },
      specific_entity_type: 'CONTACT',
      created_at: createdAt,
      updated_at: createdAt,
    },
    value: {
      type: 'EntityReference',
      value: [
        { entity_type: 'CONTACT', entity_id: 'contact' },
        { entity_type: 'CONTACT', entity_id: 'second-contact' },
        { entity_type: 'CONTACT', entity_id: 'third-contact' },
      ],
    },
  },
];
const items: EntityData[] = [
  {
    ...common,
    id: 'task',
    type: 'document',
    fileType: 'md',
    subType: { type: 'task' },
    name: 'Prepare the renewal proposal',
    properties,
  },
  {
    ...common,
    id: 'email',
    type: 'email',
    name: 'Re: Next steps',
    isRead: true,
    isDraft: false,
    isImportant: false,
    done: false,
    senderEmail: 'person@example.com',
    senderName: 'Example contact',
    participants: [{ email: 'person@example.com', name: 'Example contact' }],
    snippet: 'Thanks for the update. Let’s review the proposal together.',
  },
  {
    ...common,
    id: 'note',
    type: 'document',
    fileType: 'md',
    name: 'Discovery notes',
    properties: properties.slice(1),
  },
  {
    ...common,
    id: 'call',
    type: 'call',
    name: 'Quarterly review',
    isActive: false,
    status: 'ATTENDED',
    attended: true,
    participantIds: [],
    durationMs: 1_800_000,
    properties: properties.slice(1),
  },
];
const previews: PreviewItem[] = [
  {
    id: 'company',
    type: 'crm_company',
    name: 'Example Company',
    rawName: 'Example Company',
    loading: false,
    access: 'access',
  },
  {
    id: 'contact',
    type: 'crm_contact',
    name: 'Example Contact With a Longer Name',
    rawName: 'Example Contact With a Longer Name',
    loading: false,
    access: 'access',
  },
  {
    id: 'second-contact',
    type: 'crm_contact',
    name: 'Second Contact',
    rawName: 'Second Contact',
    loading: false,
    access: 'access',
  },
  {
    id: 'third-contact',
    type: 'crm_contact',
    name: 'Third Contact',
    rawName: 'Third Contact',
    loading: false,
    access: 'access',
  },
];
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
for (const preview of previews)
  queryClient.setQueryData(previewKeys.item(preview.id).queryKey, preview);

function Fixture() {
  const [element, setElement] = createSignal<HTMLElement>();
  const [opened, setOpened] = createSignal('Nothing opened');
  const manager = createRoutedSplitLayout(createBlockOrchestrator(), '/home');
  setGlobalSplitManager(manager);
  return (
    <main class="min-h-dvh bg-panel p-4 text-ink sm:p-8">
      <div class="mx-auto max-w-5xl">
        <h1 class="mb-4 text-lg font-medium">CRM activity</h1>
        <button
          type="button"
          onClick={() =>
            queryClient.setQueryData<PreviewItem>(
              previewKeys.item('company').queryKey,
              {
                id: 'company',
                type: 'crm_company',
                loading: false,
                access: 'no_access',
              }
            )
          }
        >
          Revoke company access
        </button>
        <button
          type="button"
          onClick={() => {
            for (const id of ['second-contact', 'third-contact']) {
              queryClient.setQueryData<PreviewItem>(
                previewKeys.item(id).queryKey,
                { id, type: 'crm_contact', loading: false, access: 'no_access' }
              );
            }
          }}
        >
          Revoke additional contacts
        </button>
        <ListLayoutProvider ref={element}>
          <div ref={setElement} class="flex flex-col overflow-x-hidden">
            <For each={items}>
              {(entity) => (
                <ListEntity
                  entity={entity}
                  hideCheckbox
                  onClick={() => setOpened(`item:${entity.id}`)}
                  referencePropertyIds={[
                    SYSTEM_PROPERTY_IDS.COMPANIES,
                    SYSTEM_PROPERTY_IDS.CONTACTS,
                  ]}
                />
              )}
            </For>
          </div>
        </ListLayoutProvider>
        <output class="mt-6 block text-xs text-ink-muted">{opened()}</output>
        <output data-testid="destination">
          {JSON.stringify(manager.activeSplit()?.content())}
        </output>
        <output data-testid="split-count">{manager.splits().length}</output>
      </div>
    </main>
  );
}
const root = document.getElementById('root');
if (root)
  render(
    () => (
      <AnalyticsContextProvider>
        <PosthogProvider>
          <QueryClientProvider client={queryClient}>
            <UserContextProvider>
              <EmailLinksContextProvider>
                <ItemDndProvider>
                  <ListEntityNoopMetadataProvider>
                    <Fixture />
                  </ListEntityNoopMetadataProvider>
                </ItemDndProvider>
              </EmailLinksContextProvider>
            </UserContextProvider>
          </QueryClientProvider>
        </PosthogProvider>
      </AnalyticsContextProvider>
    ),
    root
  );
