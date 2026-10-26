import '@app/index.css';
import { AnalyticsContextProvider } from '@app/lib/analytics/analytics-context';
import { PosthogProvider } from '@app/lib/analytics/posthog';
import { ItemDndProvider } from '@components/app/ItemDragAndDrop';
import { EmailLinksContextProvider } from '@core/context/emailLinks';
import { UserContextProvider } from '@core/context/user';
import type { DocumentEntity } from '@entity';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { Button } from '@ui';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { type CrmContext, CrmProvider } from '../context/crm-context';
import type { ItemListSource } from '../context/crm-sources';
import type { FileTypesSource } from '../context/file-types';
import { DEFAULT_FILE_TYPES, type FileTypeCatalog } from '../core/file-types';
import { RecordFiles } from '../views/record-files';

// Real record/files/dialog components with in-memory storage; no account writes.
function Fixture() {
  const [record, setRecord] = createSignal('company-a');
  const [overview, setOverview] = createSignal(true);
  const [catalog, setCatalog] = createSignal<FileTypeCatalog | null>(null);
  const [documents, setDocuments] = createSignal<DocumentEntity[]>([
    {
      id: 'shared',
      type: 'document',
      name: 'Shared contract',
      fileType: 'pdf',
      ownerId: '',
    },
    {
      id: 'view-only',
      type: 'document',
      name: 'Read-only proposal',
      fileType: 'pdf',
      ownerId: '',
    },
  ]);
  const [links, setLinks] = createSignal(
    new Map([
      ['company-a', ['shared', 'view-only']],
      ['company-b', ['shared']],
    ])
  );
  const [values, setValues] = createSignal(
    new Map<string, string | null>([
      ['shared', null],
      ['view-only', null],
    ])
  );
  const [created, setCreated] = createSignal(0);
  const [opened, setOpened] = createSignal('');
  const [failLink, setFailLink] = createSignal(false);
  const source: FileTypesSource = {
    sessionKey: () => 'viewer:team',
    data: catalog,
    pending: () => false,
    error: () => false,
    refresh: async () => {},
    canManage: () => true,
    initialize: async () => {
      setCatalog({
        definitionId: 'file-type',
        options: DEFAULT_FILE_TYPES.map((name) => ({ id: name, name })),
      });
    },
    add: async (name) => {
      setCatalog(
        (current) =>
          current && {
            ...current,
            options: [...current.options, { id: name, name }],
          }
      );
    },
    rename: async (id, name) => {
      setCatalog(
        (current) =>
          current && {
            ...current,
            options: current.options.map((option) =>
              option.id === id ? { ...option, name } : option
            ),
          }
      );
    },
    remove: async (id) => {
      setCatalog(
        (current) =>
          current && {
            ...current,
            options: current.options.filter((option) => option.id !== id),
          }
      );
      setValues(
        (current) =>
          new Map(
            [...current].map(([key, value]) => [
              key,
              value === id ? null : value,
            ])
          )
      );
    },
    classify: async (id, type) => {
      setValues((current) => new Map(current).set(id, type));
    },
    classifications: () => ({
      data: values,
      pending: () => false,
      error: () => false,
      refresh: async () => {},
    }),
    canEdit: (id) => () => id() !== 'view-only',
    candidates: (query) => ({
      files: () =>
        documents().filter((file) =>
          file.name.toLowerCase().includes(query().toLowerCase())
        ),
      pending: () => false,
      hasMore: () => false,
      error: () => undefined,
      loadMore: async () => {},
    }),
    create: async (name) => {
      setCreated((count) => count + 1);
      const id = `created-${created()}`;
      setDocuments((current) => [
        ...current,
        { id, type: 'document', name, fileType: 'md', ownerId: '' },
      ]);
      setValues((current) => new Map(current).set(id, null));
      return id;
    },
    attach: async (id, target) => {
      if (failLink()) {
        setFailLink(false);
        throw new Error('offline');
      }
      setLinks((current) =>
        new Map(current).set(target.id, [
          ...new Set([...(current.get(target.id) ?? []), id]),
        ])
      );
    },
  };
  const items: ItemListSource = {
    get data() {
      return {
        entities: documents().filter((file) =>
          links().get(record())?.includes(file.id)
        ),
      };
    },
    isPending: false,
    isEnabled: true,
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: async () => {},
    refetch: async () => {},
  };
  const context: Pick<
    CrmContext,
    'createFileTypes' | 'createRecordFiles' | 'createNavigation'
  > = {
    createFileTypes: () => source,
    createRecordFiles: () => items,
    createNavigation: () => ({
      splitId: undefined,
      openEntity: (entity) => {
        setOpened(entity.id);
      },
      openWithSplit: (entity) => {
        setOpened(entity.id);
      },
      showCompanies: () => {},
    }),
  };
  return (
    <CrmProvider value={context as CrmContext}>
      <main class="h-dvh overflow-auto bg-panel p-4 text-ink">
        <div class="mb-6 flex flex-wrap gap-2">
          <Button
            onClick={() =>
              setRecord(record() === 'company-a' ? 'company-b' : 'company-a')
            }
          >
            Switch record
          </Button>
          <Button onClick={() => setOverview(!overview())}>
            Switch surface
          </Button>
          <Button onClick={() => setFailLink(true)}>
            Fail next attachment
          </Button>
          <span aria-label="Created files">{created()}</span>
          <Button
            onClick={() =>
              setValues((current) =>
                new Map(current).set('shared', 'missing-type')
              )
            }
          >
            Simulate unavailable type
          </Button>
          <span aria-label="Opened file">{opened()}</span>
        </div>
        <h1 class="mb-5 text-xl font-semibold">
          {record() === 'company-a' ? 'Northstar' : 'Acme'} ·{' '}
          {overview() ? 'Overview' : 'Files'}
        </h1>
        <RecordFiles
          scope={{ type: 'company', id: record(), domains: [] }}
          overview={overview()}
        />
      </main>
    </CrmProvider>
  );
}

const root = document.getElementById('root');
if (root)
  render(
    () => (
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <UserContextProvider>
          <AnalyticsContextProvider>
            <PosthogProvider>
              <EmailLinksContextProvider>
                <ItemDndProvider>
                  <Fixture />
                </ItemDndProvider>
              </EmailLinksContextProvider>
            </PosthogProvider>
          </AnalyticsContextProvider>
        </UserContextProvider>
      </QueryClientProvider>
    ),
    root
  );
