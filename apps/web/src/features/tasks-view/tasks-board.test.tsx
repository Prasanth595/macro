import {
  CreateContextProvider,
  useCreateContext,
} from '@app/features/command/context/create-context';
import type { TaskComposerContext } from '@app/features/task-composer/core/context';
import { propertyValueToApi } from '@property/api/converters';
import {
  PROPERTY_OPTION_IDS,
  SYSTEM_PROPERTY_IDS,
} from '@property/identifiers';
import type { PropertyApiValues } from '@property/types';
import { cleanup, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { type Accessor, createSignal, onCleanup } from 'solid-js';
import { createStore } from 'solid-js/store';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  loadTaskComposerDraft,
  saveTaskComposerDraft,
  taskComposerContextStorage,
} from '../block-md/util/taskComposerStorage';
import type { TaskBoardData } from './context/task-board';
import type { TaskBoardColumn, TaskBoardGrouping } from './core/task-board';
import { TasksBoard } from './tasks-board';
import type { TaskCreateOptions, TasksViewState } from './types';

const launch = vi.hoisted(() => ({
  popoverSplit:
    vi.fn<
      (input: {
        type: 'component';
        id: 'task-compose';
        params: { composerContext: TaskComposerContext };
      }) => void
    >(),
}));
const [columns, setColumns] = createSignal<TaskBoardColumn[]>([]);
const [paneId, setPaneId] = createSignal('origin-pane');
const [scopeKey, setScopeKey] = createSignal<string>();
const [hostCreate, setHostCreate] = createSignal<
  ((options?: TaskCreateOptions) => void) | undefined
>();
const [state, setState] = createStore<TasksViewState>({
  layout: 'board',
  tab: 'team-tasks',
  groupBy: 'status',
  search: '',
  facets: {},
  sort: [],
  collapsedGroupIds: [],
  collapsedSidebarSectionIds: [],
});
const data: TaskBoardData = {
  columns,
  hiddenColumnCount: () => 0,
  task: () => undefined,
  createAssigneeName: () => () => undefined,
  actions: {
    canEditTask: () => true,
    canMoveTo: () => true,
    save: async () => {},
  },
  property: () => undefined,
  canEditProperty: () => true,
  saveProperty: async () => {},
  definitionError: () => false,
  retryDefinitions: async () => {},
};

vi.mock('@app/features/next-soup/utils', () => ({
  openEntityInSplitFromUnifiedList: vi.fn(),
}));
vi.mock('@components/app/split-layout/layout', () => ({
  useSplitLayout: () => launch,
}));
vi.mock('@components/app/split-layout/layoutUtils', () => ({
  useSplitPanelOrThrow: () => ({ handle: { id: paneId() } }),
}));
vi.mock('@core/context/user', () => ({
  useUserId: () => () => 'current-user',
}));
vi.mock('@property/hooks/usePropertyUserDisplay', () => ({
  usePropertyUserDisplay: () => ({ name: () => undefined }),
}));
vi.mock('./queries/task-board-queries', () => ({
  createTaskBoardQueries: () => ({ ...data, entity: () => undefined }),
}));
vi.mock('./components/task-board-property', () => ({
  TaskBoardColumnIcon: () => null,
  TaskBoardProperty: () => null,
}));
vi.mock('./tasks-view-context', () => ({
  useTasksView: () => ({
    state,
    get scopeKey() {
      return scopeKey();
    },
    get createTask() {
      return hostCreate();
    },
    projectsEnabled: () => true,
    openTask: () => false,
    setFacets: vi.fn(),
    source: {
      items: () => [],
      isLoading: () => false,
      error: () => undefined,
      hasMore: () => false,
      isLoadingMore: () => false,
      loadMore: async () => {},
      loadMoreGroup: async () => {},
      refresh: async () => {},
    },
  }),
}));
vi.mock('@app/components/kanban/kanban-virtualizer', () => ({
  createKanbanVirtualizer: (options: {
    keys: Accessor<readonly (string | number)[]>;
    getScrollElement: () => HTMLDivElement | undefined;
  }) => ({
    get scrollElement() {
      return options.getScrollElement();
    },
    getVirtualItems: () =>
      options.keys().map((key, index) => ({
        key,
        index,
        start: index * 100,
        size: 100,
      })),
    getTotalSize: () => options.keys().length * 100,
    scrollToIndex: vi.fn(),
    measureElement: vi.fn(),
    takeSnapshot: () => [],
  }),
}));

beforeEach(() => {
  launch.popoverSplit.mockReset();
  localStorage.clear();
  setPaneId('origin-pane');
  setScopeKey(undefined);
  setHostCreate(undefined);
  setState('groupBy', 'status');
  setColumns([]);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mountBoard(preset?: TaskComposerContext) {
  function Origin() {
    const context = useCreateContext();
    onCleanup(context.register(paneId(), () => ({ task: preset })));
    onCleanup(
      context.register('focused-pane', () => ({ task: { key: 'unrelated' } }))
    );
    return <TasksBoard />;
  }
  return render(() => (
    <CreateContextProvider focusedPaneId={() => 'focused-pane'}>
      <Origin />
    </CreateContextProvider>
  ));
}

it('snapshots the originating pane preset and isolates drafts between columns', async () => {
  const user = userEvent.setup();
  const preset: TaskComposerContext = {
    key: 'company:acme',
    visiblePropertyIds: [SYSTEM_PROPERTY_IDS.COMPANIES],
    initialPropertyValues: {
      [SYSTEM_PROPERTY_IDS.COMPANIES]: {
        valueType: 'ENTITY',
        refs: [{ entity_id: 'acme', entity_type: 'COMPANY' }],
      },
    },
  };
  setColumns([
    {
      id: PROPERTY_OPTION_IDS.STATUS.IN_PROGRESS,
      label: 'In progress',
      tasks: [],
      hasMore: false,
      loadingMore: false,
    },
    {
      id: PROPERTY_OPTION_IDS.STATUS.COMPLETED,
      label: 'Completed',
      tasks: [],
      hasMore: false,
      loadingMore: false,
    },
  ]);
  mountBoard(preset);

  await user.click(
    screen.getByRole('button', { name: 'Add task to In progress' })
  );
  const first = launch.popoverSplit.mock.calls[0][0].params.composerContext;
  expect(first.initialPropertyValues).toEqual({
    ...preset.initialPropertyValues,
    [SYSTEM_PROPERTY_IDS.STATUS]: {
      valueType: 'SELECT_STRING',
      values: [PROPERTY_OPTION_IDS.STATUS.IN_PROGRESS],
    },
  });
  expect(first.visiblePropertyIds).toEqual([
    SYSTEM_PROPERTY_IDS.COMPANIES,
    SYSTEM_PROPERTY_IDS.STATUS,
  ]);
  const status = first.initialPropertyValues?.[SYSTEM_PROPERTY_IDS.STATUS];
  if (!status) throw new Error('Missing column status');
  expect(propertyValueToApi(status, false)).toEqual({
    type: 'select_option',
    option_id: PROPERTY_OPTION_IDS.STATUS.IN_PROGRESS,
  });
  const firstStorage = taskComposerContextStorage(first.key);
  saveTaskComposerDraft(
    {
      title: 'In progress draft',
      content: '',
      propertyValues: first.initialPropertyValues ?? {},
    },
    firstStorage
  );

  await user.click(
    screen.getByRole('button', { name: 'Add task to Completed' })
  );
  const second = launch.popoverSplit.mock.calls[1][0].params.composerContext;
  expect(second.key).not.toBe(first.key);
  expect(
    loadTaskComposerDraft(taskComposerContextStorage(second.key))
  ).toBeNull();
  expect(loadTaskComposerDraft(firstStorage)?.title).toBe('In progress draft');
  expect(first.initialPropertyValues).toMatchObject({
    [SYSTEM_PROPERTY_IDS.STATUS]: {
      valueType: 'SELECT_STRING',
      values: [PROPERTY_OPTION_IDS.STATUS.IN_PROGRESS],
    },
  });
  expect(preset.visiblePropertyIds).toEqual([SYSTEM_PROPERTY_IDS.COMPANIES]);
});

it('does not restore a draft from another unscoped Tasks pane', async () => {
  const user = userEvent.setup();
  setColumns([
    {
      id: PROPERTY_OPTION_IDS.STATUS.IN_PROGRESS,
      label: 'In progress',
      tasks: [],
      hasMore: false,
      loadingMore: false,
    },
  ]);
  mountBoard();
  await user.click(
    screen.getByRole('button', { name: 'Add task to In progress' })
  );
  const first = launch.popoverSplit.mock.calls[0][0].params.composerContext;
  saveTaskComposerDraft(
    {
      title: 'First pane draft',
      content: '',
      propertyValues: first.initialPropertyValues ?? {},
    },
    taskComposerContextStorage(first.key)
  );
  cleanup();
  setPaneId('second-pane');
  mountBoard();
  await user.click(
    screen.getByRole('button', { name: 'Add task to In progress' })
  );
  const second = launch.popoverSplit.mock.calls[1][0].params.composerContext;

  expect(second.key).not.toBe(first.key);
  expect(
    loadTaskComposerDraft(taskComposerContextStorage(second.key))
  ).toBeNull();
  expect(
    loadTaskComposerDraft(taskComposerContextStorage(first.key))?.title
  ).toBe('First pane draft');
});

it.each<{
  grouping: TaskBoardGrouping;
  id: string;
  propertyId: string;
  value: PropertyApiValues;
}>([
  {
    grouping: 'priority',
    id: PROPERTY_OPTION_IDS.PRIORITY.URGENT,
    propertyId: SYSTEM_PROPERTY_IDS.PRIORITY,
    value: {
      valueType: 'SELECT_STRING',
      values: [PROPERTY_OPTION_IDS.PRIORITY.URGENT],
    },
  },
  {
    grouping: 'assignee',
    id: 'alice',
    propertyId: SYSTEM_PROPERTY_IDS.ASSIGNEES,
    value: {
      valueType: 'ENTITY',
      refs: [{ entity_id: 'alice', entity_type: 'USER' }],
    },
  },
  {
    grouping: 'project',
    id: 'launch',
    propertyId: SYSTEM_PROPERTY_IDS.PROJECT,
    value: {
      valueType: 'ENTITY',
      refs: [{ entity_id: 'launch', entity_type: 'INITIATIVE' }],
    },
  },
  {
    grouping: 'assignee',
    id: '',
    propertyId: SYSTEM_PROPERTY_IDS.ASSIGNEES,
    value: { valueType: 'ENTITY', refs: null },
  },
  {
    grouping: 'priority',
    id: '',
    propertyId: SYSTEM_PROPERTY_IDS.PRIORITY,
    value: { valueType: 'SELECT_STRING', values: null },
  },
  {
    grouping: 'project',
    id: '',
    propertyId: SYSTEM_PROPERTY_IDS.PROJECT,
    value: { valueType: 'ENTITY', refs: null },
  },
  {
    grouping: 'status',
    id: '',
    propertyId: SYSTEM_PROPERTY_IDS.STATUS,
    value: {
      valueType: 'SELECT_STRING',
      values: [PROPERTY_OPTION_IDS.STATUS.NOT_STARTED],
    },
  },
])(
  'launches from the $grouping column "$id" with its property selected',
  async ({ grouping, id, propertyId, value }) => {
    const user = userEvent.setup();
    setState('groupBy', grouping);
    setColumns([
      {
        id,
        label: 'Destination',
        tasks: [],
        hasMore: false,
        loadingMore: false,
      },
    ]);
    mountBoard();

    await user.click(
      screen.getByRole('button', { name: 'Add task to Destination' })
    );

    expect(launch.popoverSplit).toHaveBeenCalledWith({
      type: 'component',
      id: 'task-compose',
      params: {
        composerContext: expect.objectContaining({
          initialPropertyValues: { [propertyId]: value },
        }),
      },
    });
  }
);

it('uses the scoped host creation action and removes creation when permission is lost', async () => {
  const user = userEvent.setup();
  const create = vi.fn();
  setScopeKey('initiative:launch:tasks');
  setHostCreate(() => create);
  setColumns([
    {
      id: PROPERTY_OPTION_IDS.STATUS.IN_PROGRESS,
      label: 'In progress',
      tasks: [],
      hasMore: false,
      loadingMore: false,
    },
  ]);
  mountBoard();

  await user.click(
    screen.getByRole('button', { name: 'Add task to In progress' })
  );

  expect(create).toHaveBeenCalledWith({
    composerContext: expect.objectContaining({
      initialPropertyValues: {
        [SYSTEM_PROPERTY_IDS.STATUS]: {
          valueType: 'SELECT_STRING',
          values: [PROPERTY_OPTION_IDS.STATUS.IN_PROGRESS],
        },
      },
    }),
  });
  expect(launch.popoverSplit).not.toHaveBeenCalled();
  setHostCreate(undefined);
  expect(
    screen.queryByRole('button', { name: 'Add task to In progress' })
  ).toBeNull();
});
