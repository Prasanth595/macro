import '@app/index.css';
import { AnalyticsContextProvider } from '@app/lib/analytics/analytics-context';
import { PosthogProvider } from '@app/lib/analytics/posthog';
import { ItemDndProvider } from '@components/app/ItemDragAndDrop';
import { EmailLinksContextProvider } from '@core/context/emailLinks';
import { UserContextProvider } from '@core/context/user';
import { type EntityData, ListEntity, ListLayoutProvider } from '@entity';
import { ListEntityNoopMetadataProvider } from '@entity/composed/list-entity/list-entity-metadata-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { createSignal, For } from 'solid-js';
import { render } from 'solid-js/web';
import { ActivityAssociations } from '../components/activity-associations';
import type { ActivityAssociation } from '../core/activity-associations';

const createdAt = '2026-10-01T12:00:00Z';
const common = { ownerId: '', createdAt, updatedAt: createdAt };
const items: EntityData[] = [
  {
    ...common,
    id: 'task',
    type: 'document',
    fileType: 'md',
    subType: { type: 'task' },
    name: 'Prepare the renewal proposal',
    properties: [],
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
    properties: [],
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
  },
];
const linked: ActivityAssociation[] = [
  { type: 'company', id: 'company', name: 'Example Company', match: 'linked' },
  {
    type: 'contact',
    id: 'contact',
    name: 'Example Contact With a Longer Name',
    match: 'linked',
  },
  {
    type: 'contact',
    id: 'second-contact',
    name: 'Second Contact',
    match: 'linked',
  },
  {
    type: 'company',
    id: 'second-company',
    name: 'Second Company',
    match: 'linked',
  },
];
function Fixture() {
  const [element, setElement] = createSignal<HTMLElement>();
  const [opened, setOpened] = createSignal('Nothing opened');
  return (
    <main class="min-h-dvh bg-panel p-4 text-ink sm:p-8">
      <div class="mx-auto max-w-5xl">
        <h1 class="mb-4 text-lg font-medium">CRM activity</h1>
        <ListLayoutProvider ref={element}>
          <div ref={setElement} class="flex flex-col gap-2 overflow-x-hidden">
            <For each={items}>
              {(entity) => (
                <ListEntity
                  entity={entity}
                  hideCheckbox
                  onClick={() => setOpened(`item:${entity.id}`)}
                  footer={
                    <ActivityAssociations
                      associations={
                        entity.type === 'email'
                          ? [{ ...linked[1], match: 'email' }]
                          : linked
                      }
                      onOpen={(record, newSplit) =>
                        setOpened(
                          `${record.type}:${record.id}:${newSplit ? 'new' : 'current'}`
                        )
                      }
                    />
                  }
                />
              )}
            </For>
          </div>
        </ListLayoutProvider>
        <output class="mt-6 block text-xs text-ink-muted">{opened()}</output>
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
          <QueryClientProvider
            client={
              new QueryClient({ defaultOptions: { queries: { retry: false } } })
            }
          >
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
