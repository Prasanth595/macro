import {
  createRoutesManifest,
  decodePane,
  type RouteMatchInfo,
} from '@app/lib/split-router';
import {
  projectDetailRoute,
  projectTaskRoute,
  taskDetailRoute,
  tasksProjectsRoute,
  tasksSplitRoute,
} from '@app/routes/routes';
import { expect, it, vi } from 'vitest';
import { publicTasksTarget } from './public-tasks-target';

vi.mock('@service-storage/websocket', () => ({
  storageWS: { reconnectIfDisconnected: vi.fn() },
  createWebSocketJob: vi.fn(),
}));
vi.mock('@service-connection/websocket', () => ({
  ws: { addEventListener: vi.fn(), send: vi.fn() },
  state: () => 'closed',
  createConnectionBlockWebsocketEffect: vi.fn(),
  createConnectionWebsocketEffect: vi.fn(),
}));

const manifest = createRoutesManifest({
  definitions: [
    {
      ...tasksSplitRoute,
      children: [
        { ...projectDetailRoute, children: [projectTaskRoute] },
        tasksProjectsRoute,
        taskDetailRoute,
      ],
    },
  ],
  defaultRoute: () => ({ matches: [{ id: tasksSplitRoute.id, params: {} }] }),
});

const projectId = '01992d2f-8444-7000-8000-000000000001';

function at(path: string): RouteMatchInfo[] {
  return [...decodePane(manifest, path.split('/'))!.matches];
}

it('reads a project page from its URL', () => {
  expect(publicTasksTarget(at(`tasks/projects/${projectId}/tasks`))).toEqual({
    kind: 'project',
    projectId,
    section: 'tasks',
  });
});

it('reads a task opened inside its project with that project', () => {
  expect(
    publicTasksTarget(at(`tasks/projects/${projectId}/overview/task/t1`))
  ).toEqual({
    kind: 'task',
    taskId: 't1',
    project: { id: projectId, section: 'overview' },
  });
});

it('reads a task link on its own without a project', () => {
  expect(publicTasksTarget(at('tasks/t1'))).toEqual({
    kind: 'task',
    taskId: 't1',
  });
});

it.each([
  ['the Tasks home', at('tasks')],
  ['the projects list', at('tasks/projects')],
  [
    'a route added later',
    [...at('tasks'), { id: 'tasks-new-thing', params: {} }],
  ],
  [
    'an unknown section',
    [
      ...at('tasks'),
      { id: projectDetailRoute.id, params: { projectId, section: 'board' } },
    ],
  ],
  [
    'a task without an id',
    [...at('tasks'), { id: taskDetailRoute.id, params: { taskId: 7 } }],
  ],
  [
    'a project task outside a project',
    [...at('tasks'), { id: projectTaskRoute.id, params: { taskId: 't1' } }],
  ],
])('keeps the sign-in prompt for %s', (_, matches) => {
  expect(publicTasksTarget(matches)).toEqual({ kind: 'none' });
});
