import type { TaskEntityWithProperties } from '@entity/types/entity';
import type { GroupedSoupPaging } from '@queries/soup/graphql/create-grouped-soup-live-query';
import type { CreateGroupedSoupQueriesArgs } from '@queries/soup/grouped/create-grouped-soup-queries';
import { createComputed, createRoot, createSignal } from 'solid-js';
import { expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  groupQueries: new Map<string, unknown>(),
  groupArgs: undefined as CreateGroupedSoupQueriesArgs | undefined,
  calls: [] as { args: () => unknown; options?: () => unknown }[],
  searchState: vi.fn(),
  mapItem: vi.fn(),
}));
vi.mock('@app/features/soup', async () => ({
  ...(await import('@app/features/soup/filters')),
  ...(await import('@app/features/soup/collection/rows')),
  ...(await import('@app/features/soup/collection/row-store')),
  ...(await import('@app/features/soup/collection/transforms')),
  useSearchContext: () => ({ entityPool: () => [] }),
  createSearchState: () => {
    const search = fixture.searchState();
    if (search) return search;
    return {
      isSearching: () => false,
      usesServiceSearch: () => false,
      isSettling: () => false,
    };
  },
}));
vi.mock('@entity', async () => ({
  ...(await import('@entity/types/entity')),
  ...(await import('@entity/utils/task-properties')),
}));
vi.mock('@components/app/GlobalAppState', () => ({
  useGlobalNotificationSource: () => ({ notificationsByEntity: () => ({}) }),
}));
vi.mock('@queries/soup/transform-utils', () => ({
  mapApiSoupItemToEntity: fixture.mapItem,
}));
vi.mock('@queries/soup/items', () => ({
  useSoupAstItemsQuery: (args: () => unknown, options?: () => unknown) => {
    fixture.calls.push({ args, options });
    return fixture.query;
  },
}));
vi.mock('@queries/soup/grouped/create-grouped-soup-queries', () => ({
  createGroupedSoupQueries: (args: CreateGroupedSoupQueriesArgs) => {
    fixture.groupArgs = args;
    return { map: () => fixture.groupQueries };
  },
}));

import { useTasksDataSource } from './use-tasks-query';

it.each([
  { loadAll: false, expanded: true },
  { loadAll: true, expanded: true },
  { loadAll: true, expanded: false },
])(
  'loads all group pages only when requested (loadAll: $loadAll, expanded: $expanded)',
  async ({ loadAll, expanded }) => {
    const tasks = Array.from({ length: 30 }, (_, index) => ({
      type: 'document',
      fileType: 'md',
      id: `task-${index}`,
      name: `Task ${index}`,
      ownerId: 'viewer',
      createdAt: new Date(),
      updatedAt: new Date(),
      subType: { type: 'task', is_completed: false },
      properties: [],
    })) as unknown as TaskEntityWithProperties[];
    const [loaded, setLoaded] = createSignal(10);
    const fetchNextPage = vi.fn(async () => {
      setLoaded((count) => Math.min(count + 10, tasks.length));
    });
    fixture.query = {
      isLoading: false,
      isPending: false,
      isPlaceholderData: false,
      hasNextPage: false,
      data: {
        entities: tasks.slice(0, 10),
        itemsById: {},
        groups: [
          {
            key: 'todo',
            label: 'To do',
            displayOrder: 0,
            totalCount: tasks.length,
            itemIds: tasks.slice(0, 10).map((task) => task.id),
            nextCursor: 'next',
          },
        ],
      },
    };
    fixture.groupQueries = new Map([
      [
        'todo',
        {
          key: 'todo',
          data: () => ({ entities: tasks.slice(10, loaded()) }),
          hasNextPage: () => loaded() < tasks.length,
          isFetchingNextPage: () => false,
          fetchNextPage,
          error: () => null,
        },
      ],
    ]);
    let cleanup = () => {};
    const source = createRoot((dispose) => {
      cleanup = dispose;
      return useTasksDataSource(
        {
          tab: 'team-tasks',
          search: '',
          facets: {},
          groupBy: 'status',
          sort: [],
        },
        {
          userId: () => 'viewer',
          tagSets: () => [],
          tagSetsReady: () => true,
          isGroupExpanded: () => expanded,
          loadAll,
        }
      );
    });
    try {
      await vi.waitFor(() =>
        expect(
          source.boardRows?.().filter((row) => row.kind === 'entity')
        ).toHaveLength(loadAll ? tasks.length : 10)
      );
      expect(fetchNextPage).toHaveBeenCalledTimes(loadAll ? 2 : 0);
      if (!expanded) {
        expect(source.items().some((row) => row.kind === 'entity')).toBe(false);
      }
      expect(source.items().some((row) => row.kind === 'load-more')).toBe(
        !loadAll
      );
    } finally {
      cleanup();
      fixture.groupQueries = new Map();
    }
  }
);

it.each([false, true])(
  'drains every flat task page automatically (service search: %s)',
  async (serviceSearch) => {
    const tasks = Array.from(
      { length: 4 },
      (_, index): TaskEntityWithProperties => ({
        type: 'document',
        fileType: 'md',
        id: `task-${index}`,
        name: `Task ${index}`,
        ownerId: 'viewer',
        subType: { type: 'task', is_completed: false },
        properties: [],
      })
    );
    const [loaded, setLoaded] = createSignal(1);
    const drained = Promise.withResolvers<void>();
    const fetchNextPage = vi.fn(async () => {
      setLoaded((count) => count + 1);
      if (loaded() === tasks.length) drained.resolve();
    });
    fixture.query = {
      isLoading: false,
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
      get hasNextPage() {
        return loaded() < tasks.length;
      },
      get data() {
        return { entities: tasks.slice(0, loaded()) };
      },
      fetchNextPage,
    };
    if (serviceSearch) {
      fixture.searchState.mockReturnValueOnce({
        isSearching: () => true,
        usesServiceSearch: () => true,
        isSettling: () => false,
        isLocalSearchSettling: () => false,
        data: () => tasks.slice(0, loaded()),
        hasNextPage: () => loaded() < tasks.length,
        isFetching: () => false,
        fetchNextPage,
        error: () => undefined,
      });
    }
    let cleanup = () => {};
    const source = createRoot((dispose) => {
      cleanup = dispose;
      return useTasksDataSource(
        {
          tab: 'team-tasks',
          search: serviceSearch ? 'Task' : '',
          facets: {},
          groupBy: 'none',
          sort: [],
        },
        {
          userId: () => 'viewer',
          tagSets: () => [],
          tagSetsReady: () => true,
          isGroupExpanded: () => true,
          loadAll: true,
        }
      );
    });
    try {
      await drained.promise;
      expect(fetchNextPage).toHaveBeenCalledTimes(3);
      expect(
        source
          .items()
          .flatMap((row) => (row.kind === 'entity' ? [row.entity.id] : []))
      ).toEqual(tasks.map((task) => task.id));
      expect(source.hasMore()).toBe(false);
    } finally {
      cleanup();
      fixture.searchState.mockReset();
    }
  }
);

it.each([false, true])(
  'keeps loaded tasks visible through continuation failure and retry (service search: %s)',
  async (serviceSearch) => {
    const task: TaskEntityWithProperties = {
      type: 'document',
      fileType: 'md',
      id: 'loaded-task',
      name: 'Loaded task',
      ownerId: 'viewer',
      subType: { type: 'task', is_completed: false },
      properties: [],
    };
    const failure = new Error('Offline');
    const [queryError, setQueryError] = createSignal<Error>();
    const [pending, setPending] = createSignal(false);
    const stopped = Promise.withResolvers<void>();
    const retryStarted = Promise.withResolvers<void>();
    const finishRetry = Promise.withResolvers<void>();
    const finished = Promise.withResolvers<void>();
    const fetchNextPage = vi.fn(async () => {
      if (fetchNextPage.mock.calls.length === 1) {
        setQueryError(failure);
        return;
      }
      setPending(true);
      retryStarted.resolve();
      await finishRetry.promise;
      setQueryError(undefined);
      setPending(false);
      finished.resolve();
    });
    fixture.query = {
      isLoading: false,
      isPending: false,
      isPlaceholderData: false,
      data: { entities: [task] },
      get hasNextPage() {
        return fetchNextPage.mock.calls.length === 0;
      },
      get isFetching() {
        return pending();
      },
      get isFetchingNextPage() {
        return pending();
      },
      get isFetchNextPageError() {
        return Boolean(queryError()) && !pending();
      },
      get error() {
        return queryError();
      },
      fetchNextPage,
    };
    if (serviceSearch) {
      fixture.searchState.mockReturnValueOnce({
        isSearching: () => true,
        usesServiceSearch: () => true,
        isSettling: () => false,
        isLocalSearchSettling: () => false,
        data: () => [task],
        hasNextPage: () => fetchNextPage.mock.calls.length === 0,
        isFetching: pending,
        isFetchingNextPage: pending,
        isFetchNextPageError: () => Boolean(queryError()) && !pending(),
        fetchNextPage,
        error: queryError,
      });
    }
    let cleanup = () => {};
    const source = createRoot((dispose) => {
      cleanup = dispose;
      const source = useTasksDataSource(
        {
          tab: 'team-tasks',
          search: serviceSearch ? 'Loaded' : '',
          facets: {},
          groupBy: 'none',
          sort: [],
        },
        {
          userId: () => 'viewer',
          tagSets: () => [],
          tagSetsReady: () => true,
          isGroupExpanded: () => true,
          loadAll: true,
        }
      );
      createComputed(() => {
        if (source.paginationError?.()) stopped.resolve();
      });
      return source;
    });
    try {
      await stopped.promise;
      expect(source.paginationError?.()).toBe(failure);
      expect(source.error()).toBeUndefined();
      expect(source.items()).toHaveLength(1);

      source.retryPagination?.();
      await retryStarted.promise;
      expect(source.error()).toBeUndefined();
      expect(source.items()).toHaveLength(1);

      finishRetry.resolve();
      await finished.promise;
      expect(source.error()).toBeUndefined();
      expect(source.paginationError?.()).toBeUndefined();
      expect(fetchNextPage).toHaveBeenCalledTimes(2);
    } finally {
      finishRetry.resolve();
      cleanup();
      fixture.searchState.mockReset();
    }
  }
);

it('keeps non-pagination errors visible when tasks are already loaded', () => {
  const failure = new Error('Forbidden');
  fixture.query = {
    isLoading: false,
    isPending: false,
    isPlaceholderData: false,
    hasNextPage: false,
    data: {
      entities: [
        {
          type: 'document',
          fileType: 'md',
          id: 'loaded-task',
          name: 'Loaded task',
          ownerId: 'viewer',
          subType: { type: 'task', is_completed: false },
          properties: [],
        },
      ],
    },
    error: failure,
  };
  createRoot((dispose) => {
    try {
      const source = useTasksDataSource(
        {
          tab: 'team-tasks',
          search: '',
          facets: {},
          groupBy: 'none',
          sort: [],
        },
        {
          userId: () => 'viewer',
          tagSets: () => [],
          tagSetsReady: () => true,
          isGroupExpanded: () => true,
          loadAll: true,
        }
      );
      expect(source.items()).toHaveLength(1);
      expect(source.error()).toBe(failure);
    } finally {
      dispose();
    }
  });
});

it('delegates grouped task pagination to the current Soup query owner', async () => {
  const [paging, setPaging] = createSignal<GroupedSoupPaging>();
  const [hasMore, setHasMore] = createSignal(true);
  const task: TaskEntityWithProperties = {
    type: 'document',
    fileType: 'md',
    id: 'task',
    name: 'Task',
    ownerId: 'viewer',
    subType: { type: 'task', is_completed: false },
    properties: [],
  };
  const fetchNextPage = vi.fn(async () => {
    setHasMore(false);
  });
  fixture.query = {
    isLoading: false,
    isPending: false,
    isPlaceholderData: false,
    get groupedPaging() {
      return paging();
    },
    data: {
      entities: [task],
      itemsById: {},
      groups: [
        {
          key: 'todo',
          label: 'To do',
          totalCount: 2,
          itemIds: [task.id],
          nextCursor: 'next',
        },
      ],
    },
  };
  // The group reader consumes the owner's live capability, not another cursor chain.
  fixture.groupQueries = new Map([
    [
      'todo',
      {
        data: () => ({ entities: [] }),
        hasNextPage: () =>
          fixture.groupArgs?.groupedPaging?.()?.hasNextPage('todo') ?? false,
        isFetchingNextPage: () => false,
        fetchNextPage: () =>
          fixture.groupArgs?.groupedPaging?.()?.fetchNextPage('todo'),
        error: () => null,
      },
    ],
  ]);
  let cleanup = () => {};
  const source = createRoot((dispose) => {
    cleanup = dispose;
    return useTasksDataSource(
      {
        tab: 'team-tasks',
        search: '',
        facets: {},
        groupBy: 'status',
        sort: [],
      },
      {
        userId: () => 'viewer',
        tagSets: () => [],
        tagSetsReady: () => true,
        isGroupExpanded: () => true,
      }
    );
  });
  try {
    expect(source.items().some((row) => row.kind === 'load-more')).toBe(false);
    setPaging({
      hasNextPage: hasMore,
      isFetchingNextPage: () => false,
      error: () => null,
      fetchNextPage,
      resetToInitialPage: () => {},
    });
    expect(source.items().some((row) => row.kind === 'load-more')).toBe(true);
    await source.loadMoreGroup('todo');
    expect(fetchNextPage).toHaveBeenCalledExactlyOnceWith('todo');
    expect(source.items().some((row) => row.kind === 'load-more')).toBe(false);
  } finally {
    cleanup();
    fixture.groupQueries = new Map();
    fixture.groupArgs = undefined;
  }
});

it('retains referenced list rows but hides stale board groups and inaccessible tasks', () => {
  const [placeholder, setPlaceholder] = createSignal(false);
  const [enabled, setEnabled] = createSignal(true);
  const task = {
    type: 'document',
    fileType: 'md',
    id: 'task',
    name: 'Task',
    ownerId: 'viewer',
    createdAt: new Date(),
    updatedAt: new Date(),
    subType: { type: 'task', is_completed: false },
    properties: [
      {
        definition: { id: 'project-definition' },
        value: {
          type: 'EntityReference',
          value: [{ entity_type: 'INITIATIVE', entity_id: 'project' }],
        },
      },
    ],
  } as unknown as TaskEntityWithProperties;
  fixture.query = {
    isLoading: false,
    get isPlaceholderData() {
      return placeholder();
    },
    data: { entities: [task] },
  };
  createRoot((dispose) => {
    try {
      const source = useTasksDataSource(
        {
          tab: 'team-tasks',
          search: '',
          facets: {},
          groupBy: 'none',
          sort: [],
        },
        {
          userId: () => 'viewer',
          tagSets: () => [],
          tagSetsReady: () => true,
          isGroupExpanded: () => true,
          reference: () => ({
            propertyDefinitionId: 'project-definition',
            entityId: 'project',
          }),
          enabled,
        }
      );
      expect(source.items()).toHaveLength(1);
      expect(source.boardRows?.()).toHaveLength(1);
      expect(source.isLoading()).toBe(false);
      setPlaceholder(true);
      expect(source.items()).toHaveLength(1);
      expect(source.boardRows?.()).toEqual([]);
      expect(source.isLoading()).toBe(false);
      setPlaceholder(false);
      setEnabled(false);
      expect(source.items()).toEqual([]);
      expect(source.boardRows?.()).toEqual([]);
      expect(source.isLoading()).toBe(false);
    } finally {
      dispose();
    }
  });
});

it.each([false, true])(
  'scopes grouped continuation rows to the referenced entity (board: %s)',
  (board) => {
    const companies = 'companies-definition';
    const task = (id: string, companyId: string) =>
      ({
        type: 'document',
        fileType: 'md',
        id,
        name: id,
        ownerId: 'viewer',
        createdAt: new Date(),
        updatedAt: new Date(),
        subType: { type: 'task', is_completed: false },
        properties: [
          {
            definition: { id: companies },
            value: {
              type: 'EntityReference',
              value: [{ entity_type: 'COMPANY', entity_id: companyId }],
            },
          },
        ],
      }) as unknown as TaskEntityWithProperties;
    fixture.query = {
      isLoading: false,
      isPlaceholderData: false,
      data: {
        entities: [],
        itemsById: {},
        groups: [
          {
            key: 'todo',
            label: 'To do',
            displayOrder: 0,
            totalCount: 2,
            itemIds: [],
            nextCursor: 'next',
          },
        ],
      },
    };
    // A "Load more" page holding one task that no longer references Acme.
    fixture.groupQueries = new Map([
      [
        'todo',
        {
          data: () => ({
            entities: [task('linked', 'acme'), task('unlinked', 'globex')],
          }),
          hasNextPage: () => false,
          isFetchingNextPage: () => false,
          fetchNextPage: async () => {},
        },
      ],
    ]);
    createRoot((dispose) => {
      try {
        const source = useTasksDataSource(
          {
            tab: 'team-tasks',
            search: '',
            facets: {},
            groupBy: 'status',
            sort: [],
          },
          {
            userId: () => 'viewer',
            tagSets: () => [],
            tagSetsReady: () => true,
            isGroupExpanded: () => !board,
            board: () => board,
            reference: () => ({
              propertyDefinitionId: companies,
              entityId: 'acme',
            }),
          }
        );
        const rows = board ? source.boardRows?.() : source.items();
        expect(
          rows?.flatMap((row) => (row.kind === 'entity' ? [row.entity.id] : []))
        ).toEqual(['linked']);
      } finally {
        dispose();
        fixture.groupQueries = new Map();
      }
    });
  }
);

it('exposes uncollapsed board rows and hides stale groups during query changes', () => {
  const [pending, setPending] = createSignal(false);
  const task: TaskEntityWithProperties = {
    type: 'document',
    fileType: 'md',
    id: 'task',
    name: 'Task',
    ownerId: 'viewer',
    subType: { type: 'task', is_completed: false },
    properties: [],
  };

  fixture.query = {
    get isPending() {
      return pending();
    },
    get isLoading() {
      return pending();
    },
    data: {
      entities: [task],
      itemsById: {},
      groups: [
        { key: 'todo', label: 'To do', totalCount: 1, itemIds: ['task'] },
      ],
    },
  };
  fixture.groupQueries = new Map();

  createRoot((dispose) => {
    try {
      const source = useTasksDataSource(
        {
          tab: 'team-tasks',
          search: '',
          facets: {},
          groupBy: 'status',
          sort: [],
        },
        {
          userId: () => 'viewer',
          tagSets: () => [],
          tagSetsReady: () => true,
          isGroupExpanded: () => false,
          board: () => true,
        }
      );

      expect(
        source.items().filter((row) => row.kind === 'entity')
      ).toHaveLength(0);
      expect(
        source.boardRows?.().filter((row) => row.kind === 'entity')
      ).toHaveLength(1);

      setPending(true);

      expect(source.boardRows?.()).toEqual([]);
      expect(source.boardLoading?.()).toBe(true);

      setPending(false);

      expect(
        source.boardRows?.().filter((row) => row.kind === 'entity')
      ).toHaveLength(1);
    } finally {
      dispose();
    }
  });
});

const COMPANIES = '00000001-0000-0000-0000-00000000000c';

function crmTask(id: string, companyIds: string[] = []) {
  return {
    type: 'document',
    fileType: 'md',
    id,
    name: id,
    ownerId: 'viewer',
    createdAt: new Date(),
    updatedAt: new Date(),
    subType: { type: 'task', is_completed: false },
    properties: companyIds.length
      ? [
          {
            definition: { id: COMPANIES },
            value: {
              type: 'EntityReference',
              value: companyIds.map((entity_id) => ({
                entity_type: 'COMPANY',
                entity_id,
              })),
            },
          },
        ]
      : [],
  } as unknown as TaskEntityWithProperties;
}

function crmSource(groupBy: 'none' | 'status' = 'none') {
  return useTasksDataSource(
    { tab: 'team-tasks', search: '', facets: {}, groupBy, sort: [] },
    {
      userId: () => 'viewer',
      tagSets: () => [],
      tagSetsReady: () => true,
      isGroupExpanded: () => true,
      crm: () => ({ type: 'company', id: 'acme' }),
    }
  );
}

it('keeps server-matched CRM tasks that only mention the record', () => {
  fixture.calls = [];
  fixture.query = {
    isLoading: false,
    isPending: false,
    isPlaceholderData: false,
    data: { entities: [crmTask('mention-only'), crmTask('linked', ['acme'])] },
  };
  createRoot((dispose) => {
    try {
      const source = crmSource();
      expect(
        source
          .items()
          .flatMap((row) => (row.kind === 'entity' ? [row.entity.id] : []))
      ).toEqual(['mention-only', 'linked']);
      const query = fixture.calls[0]?.args() as {
        body: Record<string, unknown>;
      };
      expect(query.body.crma).toEqual({ company: 'acme' });
      expect(query.body.propf).toBeUndefined();
      // The search service cannot express the scope, so it is not used.
      expect(fixture.searchState).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });
});

it('keeps CRM continuation rows the server returned for a group', () => {
  fixture.query = {
    isLoading: false,
    isPending: false,
    isPlaceholderData: false,
    data: {
      entities: [],
      itemsById: {},
      groups: [
        {
          key: 'todo',
          label: 'To do',
          displayOrder: 0,
          totalCount: 2,
          itemIds: [],
          nextCursor: 'next',
        },
      ],
    },
  };
  fixture.groupQueries = new Map([
    [
      'todo',
      {
        data: () => ({
          entities: [crmTask('contact-mention'), crmTask('linked', ['acme'])],
        }),
        hasNextPage: () => false,
        isFetchingNextPage: () => false,
        fetchNextPage: async () => {},
      },
    ],
  ]);
  createRoot((dispose) => {
    try {
      const source = crmSource('status');
      expect(
        source
          .items()
          .flatMap((row) => (row.kind === 'entity' ? [row.entity.id] : []))
      ).toEqual(['contact-mention', 'linked']);
    } finally {
      dispose();
      fixture.groupQueries = new Map();
    }
  });
});

it('admits only optimistic CRM tasks that name the record', () => {
  fixture.calls = [];
  fixture.query = {
    isLoading: false,
    isPending: false,
    isPlaceholderData: false,
    data: { entities: [] },
  };
  createRoot((dispose) => {
    try {
      crmSource();
      const options = fixture.calls[0]?.options?.() as {
        meta: { insertFilter: (item: unknown) => boolean };
      };
      fixture.mapItem.mockReturnValueOnce(crmTask('created', ['acme']));
      expect(options.meta.insertFilter({})).toBe(true);
      fixture.mapItem.mockReturnValueOnce(crmTask('unrelated', ['globex']));
      expect(options.meta.insertFilter({})).toBe(false);
      fixture.mapItem.mockReturnValueOnce(crmTask('cached'));
      expect(options.meta.insertFilter({})).toBe(false);
    } finally {
      dispose();
    }
  });
});
