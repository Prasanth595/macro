import {
  PROPERTY_OPTION_IDS,
  SYSTEM_PROPERTY_IDS,
} from '@property/identifiers';
import type { Property } from '@property/types';
import type { EntityPropertyWithDefinition } from '@service-properties/generated/schemas/entityPropertyWithDefinition';
import type { PropertyDefinition } from '@service-properties/generated/schemas/propertyDefinition';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { err, ok } from 'neverthrow';
import type { Accessor, ComponentProps, JSX, ParentProps } from 'solid-js';
import { For } from 'solid-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const doubles = vi.hoisted(() => ({
  dssFetch: vi.fn(),
  getEntityProperties: vi.fn(),
  navigate: vi.fn(async () => {}),
  rememberDisplayNames: vi.fn(),
  pills: [] as boolean[],
  editor: [] as boolean[],
}));
vi.mock('@service-storage/client', () => ({ dssFetch: doubles.dssFetch }));
vi.mock('@service-properties/client', () => ({
  propertiesServiceClient: { getEntityProperties: doubles.getEntityProperties },
}));
vi.mock('@core/user/displayName', () => ({
  rememberDisplayNames: doubles.rememberDisplayNames,
}));
vi.mock('@app/lib/split-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/lib/split-router')>()),
  useNavigate: () => doubles.navigate,
}));
vi.mock('@app/routes/routes', () => ({
  projectDetailRoute: { id: 'project-detail' },
  projectTaskRoute: { id: 'project-task' },
}));
vi.mock('@components/app/split-layout/layoutUtils', () => ({
  useSplitDisplayName: () => {},
}));
vi.mock('@components/app/split-layout/split-router/app-route-shell', () => ({
  SignedOutRoute: () => <p>Sign in to view this page</p>,
}));
vi.mock('@app/features/tasks-view/public/public-task-detail', () => ({
  PublicTaskDetail: (props: { taskId: string }) => <p>Task {props.taskId}</p>,
}));
vi.mock('@app/components/entity-detail/EntityDetailTopBar', () => ({
  EntityDetailTopBar: (props: ParentProps<{ navigation?: JSX.Element }>) => (
    <header>
      {props.navigation}
      {props.children}
    </header>
  ),
}));
vi.mock('@app/components/view-shell', () => ({
  ViewBreadcrumbs: {
    Root: (props: ParentProps) => <nav>{props.children}</nav>,
    Item: (props: {
      children(item: { isActive(): boolean; onSelect(): void }): JSX.Element;
    }) => props.children({ isActive: () => false, onSelect: () => {} }),
    Button: (props: ParentProps) => <span>{props.children}</span>,
  },
}));
vi.mock('@components/app/side-panel', () => ({
  SidePanel: {
    Root: (props: ParentProps) => <>{props.children}</>,
    Layout: (props: ParentProps) => <>{props.children}</>,
    Footer: (props: ParentProps) => <>{props.children}</>,
    Section: (props: ParentProps) => <>{props.children}</>,
  },
}));
vi.mock('@components/app/side-panel/EntityMetadata', () => ({
  EntityMetadata: () => null,
}));
vi.mock('@core/component/InlineTitleEditor', () => ({
  InlineTitleEditor: (props: { ariaLabel: string }) => (
    <input aria-label={props.ariaLabel} />
  ),
}));
vi.mock('@property/component/PropertyValuePill', () => ({
  PropertyValuePill: (props: { property: Property; canEdit: boolean }) => {
    doubles.pills.push(props.canEdit);
    return <span>{props.property.displayName}</span>;
  },
}));
vi.mock('@core/collab-surface/CollabMarkdownEditor', () => ({
  CollabMarkdownEditor: (props: { canEdit: Accessor<boolean> }) => {
    doubles.editor.push(props.canEdit());
    return <div>Description editor</div>;
  },
}));
vi.mock('../queries/public-project-description', () => ({
  createPublicProjectDescriptionSession: () => ({
    connectionError: () => undefined,
    dispose: () => {},
  }),
}));
vi.mock('../queries/production-project-description', () => ({
  createProductionProjectDescriptionSession: () => {
    throw new Error('a visitor never ensures the surface');
  },
}));
vi.mock('../components/project-skeletons', () => ({
  ProjectContentSkeleton: () => <p>Loading project</p>,
  ProjectDescriptionSkeleton: () => <p>Loading description</p>,
}));
vi.mock('@ui', () => ({
  Button: (props: ParentProps<{ onClick(): void }>) => (
    <button type="button" onClick={() => props.onClick()}>
      {props.children}
    </button>
  ),
  EmptyStatePanel: (props: ParentProps<{ title: string }>) => (
    <section>
      <h2>{props.title}</h2>
      {props.children}
    </section>
  ),
  Tabs: (props: {
    options: { value: string; label: string }[];
    onChange(value: string): void;
  }) => (
    <For each={props.options}>
      {(option) => (
        <button type="button" onClick={() => props.onChange(option.value)}>
          {option.label}
        </button>
      )}
    </For>
  ),
}));

import { PublicProjectRoute } from './public-project-view';

const { STATUS, PRIORITY, ASSIGNEES, DUE_DATE } = SYSTEM_PROPERTY_IDS;
const IN_PROGRESS = PROPERTY_OPTION_IDS.STATUS.IN_PROGRESS;

function projectProperty(
  id: string,
  name: string,
  type: PropertyDefinition['data_type']
): EntityPropertyWithDefinition {
  return {
    definition: {
      id,
      display_name: name,
      data_type: type,
      created_at: '',
      updated_at: '',
      is_system: true,
      is_metadata: false,
      is_multi_select: false,
      specific_entity_type: null,
      owner: { scope: 'system' },
    },
    options: [],
    property: {
      id: `project-${id}`,
      property_definition_id: id,
      entity_id: 'project-1',
      entity_type: 'INITIATIVE',
      created_at: '',
      updated_at: '',
    },
    value: null,
  };
}

const unset = {
  status: null,
  priority: null,
  assignees: [],
  dueDate: null,
  completed: false,
};

/** A project read through a link that grants edit. */
const editable = {
  summary: {
    id: '01992d2f-8444-7000-8000-000000000001',
    name: 'Launch',
    updatedAt: '2026-10-01T00:00:00Z',
    userAccessLevel: 'edit',
    properties: { ...unset, status: IN_PROGRESS },
    taskCount: 1,
    completedTaskCount: 0,
  },
  ownerId: 'macro|owner@macro.com',
  tasks: [
    {
      id: 'task-1',
      name: 'Pick a date',
      properties: { ...unset, status: IN_PROGRESS },
    },
  ],
  people: [],
  description: { state: 'live', token: 'grant-1' },
};

function serve(read: unknown) {
  doubles.dssFetch.mockResolvedValue(read);
  doubles.getEntityProperties.mockResolvedValue(
    ok({
      entity_id: editable.summary.id,
      properties: [
        projectProperty(STATUS, 'Status', 'SELECT_STRING'),
        projectProperty(PRIORITY, 'Priority', 'SELECT_STRING'),
        projectProperty(ASSIGNEES, 'Assignees', 'ENTITY'),
        projectProperty(DUE_DATE, 'Due date', 'DATE'),
      ],
    })
  );
}

let client: QueryClient;

function show(props: ComponentProps<typeof PublicProjectRoute>) {
  return render(() => (
    <QueryClientProvider client={client}>
      <PublicProjectRoute {...props} />
    </QueryClientProvider>
  ));
}

beforeEach(() => {
  // Like the app's client, keep a read fresh instead of fetching on every mount.
  client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
});

afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
  doubles.pills = [];
  doubles.editor = [];
});

it('never offers editing, even when the link grants edit', async () => {
  serve(ok(editable));
  show({ projectId: editable.summary.id, section: 'overview' });

  expect(await screen.findByRole('heading', { name: 'Launch' })).toBeTruthy();
  expect(screen.queryByLabelText('Project name')).toBeNull();
  expect(doubles.pills).toEqual([false, false, false, false]);
  expect(screen.getByText('Description editor')).toBeTruthy();
  expect(doubles.editor).toEqual([false]);
  expect(screen.getByText('Sign in to view comments.')).toBeTruthy();
  expect(screen.queryByText('New task')).toBeNull();
  expect(screen.queryByText(/share/i)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Login' })).toBeNull();
});

it('remembers the names the project read hands over', async () => {
  serve(
    ok({
      ...editable,
      people: [{ id: editable.ownerId, firstName: 'Olive', lastName: 'Owner' }],
    })
  );
  show({ projectId: editable.summary.id, section: 'overview' });

  expect(await screen.findByRole('heading', { name: 'Launch' })).toBeTruthy();
  expect(doubles.rememberDisplayNames).toHaveBeenCalledWith([
    { id: editable.ownerId, firstName: 'Olive', lastName: 'Owner' },
  ]);
});

it('remembers no names for a project the visitor may not view', async () => {
  serve(err([{ code: 'UNAUTHORIZED', message: 'no' }]));
  show({ projectId: editable.summary.id, section: 'overview' });

  expect(await screen.findByText('Sign in to view this page')).toBeTruthy();
  expect(doubles.rememberDisplayNames).not.toHaveBeenCalled();
});

it('lists visible tasks read-only and opens one in the project', async () => {
  serve(ok(editable));
  show({ projectId: editable.summary.id, section: 'tasks' });

  fireEvent.click(await screen.findByRole('button', { name: 'Pick a date' }));

  expect(doubles.navigate).toHaveBeenCalledWith({
    route: { id: 'project-task' },
    params: {
      projectId: editable.summary.id,
      section: 'tasks',
      taskId: 'task-1',
    },
  });
  expect(screen.queryByText('New task')).toBeNull();
});

it('opens a project task under the project name', async () => {
  serve(ok(editable));
  show({ projectId: editable.summary.id, section: 'tasks', taskId: 'task-1' });

  expect(screen.getByText('Task task-1')).toBeTruthy();
  expect(await screen.findByText('Launch')).toBeTruthy();
});

it('shows a project the visitor may not view as the sign-in prompt', async () => {
  serve(err([{ code: 'UNAUTHORIZED', message: 'no' }]));
  show({ projectId: editable.summary.id, section: 'overview' });

  expect(await screen.findByText('Sign in to view this page')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Launch' })).toBeNull();
});

it('retries a read that failed', async () => {
  serve(err([{ code: 'SERVER_ERROR', message: 'down' }]));
  show({ projectId: editable.summary.id, section: 'overview' });
  const retry = await screen.findByRole('button', { name: 'Try again' });

  serve(ok(editable));
  fireEvent.click(retry);

  expect(await screen.findByRole('heading', { name: 'Launch' })).toBeTruthy();
});

it('shows the project as it is now when the visitor comes back', async () => {
  serve(ok(editable));
  const first = show({ projectId: editable.summary.id, section: 'overview' });
  expect(await screen.findByRole('heading', { name: 'Launch' })).toBeTruthy();
  first.unmount();

  serve(
    ok({ ...editable, summary: { ...editable.summary, name: 'Relaunch' } })
  );
  show({ projectId: editable.summary.id, section: 'overview' });

  expect(await screen.findByRole('heading', { name: 'Relaunch' })).toBeTruthy();
});
