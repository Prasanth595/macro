import '@app/index.css';
import { ViewShell } from '@app/components/view-shell';
import { CreateContextProvider } from '@app/features/command/context/create-context';
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
import { Tabs } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { render } from 'solid-js/web';
import { EMPTY_TAG_FACET_CONTEXT } from '../../soup';
import { CrmProvider } from '../context/crm-context';
import type { ItemListSource } from '../context/crm-sources';
import type { CrmActivityViewState } from '../core/activity-view';
import { CRM_ACTIVITY_TABS, type CrmActivityTab } from '../core/navigation';
import { createAppCrmContext } from '../crm-adapter';
import {
  buildCrmActivityQuery,
  crmActivityItemMatches,
} from '../queries/activity-options';
import { CrmActivityView } from '../views/activity';
import { RecordItemList } from '../views/record-item-list';

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

function DateGroupingFixture() {
  const [tab, setTab] = createSignal<CrmActivityTab>('tasks');
  const [page, setPage] = createSignal(1);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const activity = { tasks: items[0], email: items[1] };
  const firstPage = (kind: 'tasks' | 'email'): EntityData[] =>
    Array.from({ length: 12 }, (_, index) => ({
      ...activity[kind],
      id: index === 0 ? activity[kind].id : `${kind}-${index}`,
      name: index === 0 ? activity[kind].name : `${kind} item ${index}`,
      updatedAt: today.toISOString(),
    }));
  const pages: Record<'tasks' | 'email', EntityData[][]> = {
    tasks: [
      firstPage('tasks'),
      [
        {
          ...items[0],
          id: 'task-next',
          name: 'Next task today',
          updatedAt: today.toISOString(),
        },
        {
          ...items[0],
          id: 'task-older',
          name: 'Task yesterday',
          updatedAt: yesterday.toISOString(),
        },
      ],
    ],
    email: [
      firstPage('email'),
      [
        {
          ...items[1],
          id: 'email-next',
          name: 'Next email today',
          updatedAt: today.toISOString(),
        },
        {
          ...items[1],
          id: 'email-older',
          name: 'Email yesterday',
          updatedAt: yesterday.toISOString(),
        },
      ],
    ],
  };
  const crm = createAppCrmContext();
  crm.createActivity = (selected): ItemListSource => ({
    isPending: false,
    isEnabled: true,
    isLoading: false,
    get data() {
      const rows = pages[selected() === 'email' ? 'email' : 'tasks'];
      return { entities: page() === 1 ? rows[0] : [...rows[0], ...rows[1]] };
    },
    get hasNextPage() {
      return page() === 1;
    },
    isFetchingNextPage: false,
    isError: false,
    isFetchNextPageError: false,
    fetchNextPage: async () => {
      setPage(2);
    },
    refetch: async () => {},
  });
  return (
    <CrmProvider value={crm}>
      <main class="flex h-dvh flex-col bg-panel text-ink">
        <Tabs
          aria-label="Activity sections"
          touch="inset"
          options={CRM_ACTIVITY_TABS.filter(
            (item) => item.id === 'tasks' || item.id === 'email'
          ).map((item) => ({ value: item.id, label: item.label }))}
          value={tab()}
          onChange={(value) => {
            setPage(1);
            setTab(value);
          }}
        />
        <div data-testid="activity-scroll" class="flex h-48 flex-col">
          <Show when={tab()} keyed>
            {(active) => (
              <div class="min-h-0 flex-1 overflow-y-auto">
                <RecordItemList
                  source={crm.createActivity(() => active)}
                  empty="Nothing"
                  groupByDate
                  referencePropertyIds={[
                    SYSTEM_PROPERTY_IDS.COMPANIES,
                    SYSTEM_PROPERTY_IDS.CONTACTS,
                  ]}
                />
              </div>
            )}
          </Show>
        </div>
      </main>
    </CrmProvider>
  );
}

function ActivityControlsFixture() {
  const crm = createAppCrmContext();
  const [tab, setTab] = createSignal<CrmActivityTab>('email');
  const controls = {
    email: createStore<CrmActivityViewState>({
      search: '',
      facets: {},
      sort: 'updated_at',
      direction: 'desc',
      groupBy: 'date',
    }),
    notes: createStore<CrmActivityViewState>({
      search: '',
      facets: {},
      sort: 'updated_at',
      direction: 'desc',
      groupBy: 'none',
    }),
    calls: createStore<CrmActivityViewState>({
      search: '',
      facets: {},
      sort: 'updated_at',
      direction: 'desc',
      groupBy: 'none',
    }),
  };
  crm.createActivityState = (active) =>
    controls[active === 'tasks' ? 'email' : active];
  const email = items.find((entity) => entity.type === 'email');
  if (!email) throw new Error('Missing email fixture');
  const rows: EntityData[] = [
    {
      ...email,
      id: 'unread-email',
      name: 'Unread message',
      isRead: false,
      updatedAt: new Date().toISOString(),
    },
    {
      ...email,
      id: 'read-email',
      name: 'Read message',
      updatedAt: new Date(2020, 0, 1).toISOString(),
    },
    items[2],
    items[3],
  ];
  crm.createActivity = (active, options) => ({
    isPending: false,
    isEnabled: true,
    isLoading: false,
    isError: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    hasNextPage: false,
    get data() {
      const selected = rows.filter(
        (entity) =>
          (active() === 'email'
            ? entity.type === 'email'
            : active() === 'notes'
              ? entity.type === 'document'
              : entity.type === 'call') &&
          (!options ||
            crmActivityItemMatches(
              entity,
              active(),
              options(),
              EMPTY_TAG_FACET_CONTEXT
            ))
      );
      selected.sort((a, b) =>
        String(b.updatedAt).localeCompare(String(a.updatedAt))
      );
      if (options?.().direction === 'asc') selected.reverse();
      return { entities: selected };
    },
    fetchNextPage: async () => {},
    refetch: async () => {},
  });
  return (
    <CrmProvider value={crm}>
      <ViewShell.Root>
        <ViewShell.Main>
          <nav class="flex gap-3 p-3">
            <For each={['email', 'notes', 'calls'] as const}>
              {(active) => (
                <button onClick={() => setTab(active)}>{active}</button>
              )}
            </For>
          </nav>
          <Show when={tab()} keyed>
            {(active) => <CrmActivityView tab={active} title={active} />}
          </Show>
          <output data-testid="activity-query" class="break-all text-xs">
            {JSON.stringify(
              buildCrmActivityQuery(
                tab(),
                controls[
                  tab() === 'notes'
                    ? 'notes'
                    : tab() === 'calls'
                      ? 'calls'
                      : 'email'
                ][0]
              )
            )}
          </output>
        </ViewShell.Main>
      </ViewShell.Root>
    </CrmProvider>
  );
}

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
                    <Show
                      when={
                        new URLSearchParams(location.search).get('mode') ===
                        'dates'
                      }
                      fallback={
                        <Show
                          when={
                            new URLSearchParams(location.search).get('mode') ===
                            'controls'
                          }
                          fallback={<Fixture />}
                        >
                          <CreateContextProvider
                            focusedPaneId={() => undefined}
                          >
                            <ActivityControlsFixture />
                          </CreateContextProvider>
                        </Show>
                      }
                    >
                      <CreateContextProvider focusedPaneId={() => undefined}>
                        <DateGroupingFixture />
                      </CreateContextProvider>
                    </Show>
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
