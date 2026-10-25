import { cleanup, render, screen } from '@solidjs/testing-library';
import { createSignal, type ParentProps } from 'solid-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const [authenticated, setAuthenticated] = createSignal<boolean | undefined>();
const mountMemberTasks = vi.fn();

vi.mock('@core/auth', () => ({
  useIsAuthenticated: () => authenticated,
}));
vi.mock('@components/app/split-layout/layoutUtils', () => ({
  useSplitPanelOrThrow: () => ({ handle: {} }),
}));
vi.mock('@app/lib/analytics/analytics-context', () => ({
  useAnalytics: () => ({ pageView: vi.fn(), track: vi.fn() }),
}));
vi.mock('@app/lib/analytics/posthog', () => ({}));
vi.mock('@app/lib/split-router', () => ({
  useSplitRouter: () => ({}),
  useParams: () => ({}),
}));
vi.mock('@app/routes/routes', () => ({}));
vi.mock('@app/features/projects/project-detail', () => ({}));
vi.mock('@app/features/projects/projects', () => ({}));
vi.mock('@app/features/projects/views/project-tasks-list', () => ({}));
vi.mock('@components/app/side-panel', () => ({}));
vi.mock('@core/component/LoadingBlock', () => ({
  LoadingBlock: () => <div>Loading</div>,
}));
vi.mock('@core/component/TopBar/LoginButton', () => ({
  LoginButton: () => <button type="button">Login</button>,
}));
vi.mock('./components/TasksDetailView', () => ({}));
vi.mock('./tasks-view', () => ({
  TasksView: () => {
    mountMemberTasks();
    return <div>My tasks</div>;
  },
}));
vi.mock('./tasks-view-skeleton', () => ({
  TasksViewSkeleton: () => <div>Confirming session</div>,
}));
vi.mock('./public/public-tasks-route-view', () => ({
  PublicTasksRouteView: () => <div>Public project</div>,
}));

// Keep the real withAuth gate; only the app view chrome is stubbed.
vi.mock(
  '@components/app/split-layout/split-router/app-route-shell',
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import('@components/app/split-layout/split-router/app-route-shell')
      >();
    return {
      ...original,
      AppView: (props: ParentProps) => <>{props.children}</>,
    };
  }
);

import { TasksRouteView } from './route-views';

beforeEach(() => {
  setAuthenticated(undefined);
  mountMemberTasks.mockClear();
});
afterEach(cleanup);

it('shows a signed-out visitor the public face without mounting member Tasks', () => {
  setAuthenticated(false);
  render(() => <TasksRouteView />);

  expect(screen.getByText('Public project')).toBeTruthy();
  expect(screen.queryByText('My tasks')).toBeNull();
  expect(mountMemberTasks).not.toHaveBeenCalled();
});

it('keeps member Tasks once signed in', () => {
  setAuthenticated(false);
  render(() => <TasksRouteView />);
  setAuthenticated(true);

  expect(screen.getByText('My tasks')).toBeTruthy();
  expect(screen.queryByText('Public project')).toBeNull();
});
