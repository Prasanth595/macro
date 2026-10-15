import {
  createMemoryHistory,
  createMemoryPaneStore,
  createSplitRouter,
  defineRoute,
  type PaneId,
  type SplitRouterOptions,
} from '@app/lib/split-router';
import { createTestPolicy } from '@app/lib/split-router/tests/fixtures';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import {
  createSignal,
  type JSX,
  onCleanup,
  type ParentProps,
  splitProps,
} from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ListNav } from './list-nav';
import { SIDEBAR_NEXT_NAV_ITEMS } from './nav-items';
import { SidebarPrefsProvider } from './use-sidebar-prefs';

const mocks = vi.hoisted(() => ({
  activeContent: (): { type: 'component'; id: string } | undefined => undefined,
  navigate: vi.fn(),
}));

vi.mock('@app/lib/analytics/analytics-context', () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));
vi.mock('@app/signal/splitLayout', () => ({
  globalSplitManager: () => ({
    activeSplit: () => ({ content: mocks.activeContent }),
    returnFocus: vi.fn(),
  }),
}));
vi.mock('@components/app/app-sidebar/sidebar', () => ({
  navigateToSidebarView: mocks.navigate,
  sidebarContent: (id: string) => ({ type: 'component', id }),
  SidebarOpenInSplitMenu: (props: ParentProps) => props.children,
}));
vi.mock('@components/app/split-layout/layout', () => ({
  useSplitLayout: () => ({
    openWithSplit: vi.fn(),
    preloadContent: vi.fn(),
  }),
}));
vi.mock('@ui', async () => ({
  ...(await import('@ui/utils/classname')),
  Button: (
    props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
  ) => {
    const [local, rest] = splitProps(props, ['label']);
    return <button type="button" aria-label={local.label} {...rest} />;
  },
}));

const home = SIDEBAR_NEXT_NAV_ITEMS.find((item) => item.id === 'home')!;
const agents = SIDEBAR_NEXT_NAV_ITEMS.find((item) => item.id === 'agents')!;

function setup(initial = '/home', agentsPreload?: () => Promise<void>) {
  const history = createMemoryHistory(initial);
  let router!: ReturnType<typeof createSplitRouter>;
  let focus!: (pane: PaneId) => void;
  render(() => {
    router = createSplitRouter({
      routes: {
        definitions: [
          defineRoute({
            id: 'app',
            children: [
              defineRoute({ id: 'home', path: 'home' }),
              defineRoute({
                id: 'agents',
                path: 'agents',
                preload: agentsPreload,
              }),
              defineRoute({ id: 'settings', path: 'settings' }),
            ],
          }),
        ],
        defaultRoute: () => ({
          matches: [
            { id: 'app', params: {} },
            { id: 'home', params: {} },
          ],
        }),
      },
      history,
      paneStore: createMemoryPaneStore(),
      policy: createTestPolicy().policy,
    } satisfies SplitRouterOptions);
    const [focusedPane, setFocusedPane] = createSignal(router.panes()[0]!);
    focus = setFocusedPane;
    mocks.activeContent = () => {
      const entry = router.entry(focusedPane());
      const id = entry?.location.route.matches.at(-1)?.id;
      return id ? { type: 'component', id } : undefined;
    };
    mocks.navigate.mockImplementation(({ viewId }: { viewId: string }) => {
      void router.navigatePane(focusedPane(), `/${viewId}`, {
        allowDuplicate: true,
      });
    });
    onCleanup(() => router.dispose());
    return (
      <SidebarPrefsProvider>
        <ListNav item={home} />
        <ListNav item={agents} />
      </SidebarPrefsProvider>
    );
  });
  return { router, history, focus };
}

function expectSelection(label?: string) {
  const buttons = screen.getAllByRole('button');
  const selected = buttons.filter((button) =>
    button.hasAttribute('data-active')
  );
  expect(selected).toHaveLength(label ? 1 : 0);
  for (const button of buttons) {
    const active = button.getAttribute('aria-label') === label;
    expect(button.hasAttribute('data-active')).toBe(active);
    expect(button.getAttribute('aria-current')).toBe(active ? 'page' : null);
  }
}

function press(label: string) {
  fireEvent.mouseDown(screen.getByRole('button', { name: label }), {
    button: 0,
  });
}

afterEach(() => {
  cleanup();
  mocks.navigate.mockReset();
});

describe('ListNav', () => {
  it('lets a rapid Home press supersede Agents without losing the current selection', () => {
    const { router, history } = setup();
    press('Agents');
    press('Home');

    expect(mocks.navigate).toHaveBeenCalledTimes(2);
    expect(
      router.entry(router.panes()[0]!)?.location.route.matches.at(-1)?.id
    ).toBe('home');
    expect(history.read().path).toBe('/home');
    expectSelection('Home');
  });

  it('ignores a late Agents preload after Home supersedes it', async () => {
    let finishPreload!: () => void;
    const preload = new Promise<void>((resolve) => {
      finishPreload = resolve;
    });
    const { router, history } = setup('/home', () => preload);
    press('Agents');
    expect(
      router.pending(router.panes()[0]!)?.to.location.route.matches.at(-1)?.id
    ).toBe('agents');
    expectSelection('Home');

    press('Home');
    finishPreload();
    await router.settled();
    expect(history.read().path).toBe('/home');
    expect(
      router.entry(router.panes()[0]!)?.location.route.matches.at(-1)?.id
    ).toBe('home');
    expectSelection('Home');
  });

  it('keeps the current view selected when a leave guard refuses navigation', () => {
    const { router, history } = setup();
    const pane = router.panes()[0]!;
    router.registerGuard(pane, 1, () => false);
    press('Agents');

    expect(mocks.navigate).toHaveBeenCalledOnce();
    expect(router.entry(pane)?.location.route.matches.at(-1)?.id).toBe('home');
    expect(history.read().path).toBe('/home');
    expectSelection('Home');
  });

  it('tracks history traversal instead of the last pressed destination', () => {
    const { router, history } = setup();
    press('Agents');
    expect(history.read().path).toBe('/agents');
    expectSelection('Agents');

    history.back();
    expect(history.read().path).toBe('/home');
    expect(
      router.entry(router.panes()[0]!)?.location.route.matches.at(-1)?.id
    ).toBe('home');
    expectSelection('Home');
    history.forward();
    expect(history.read().path).toBe('/agents');
    expectSelection('Agents');
  });

  it('selects the view in the focused split, not the first URL pane', () => {
    const { router, history, focus } = setup('/home/~/agents');
    const [first, second] = router.panes();
    expect(history.read().path).toBe('/home/~/agents');
    expect(router.entry(first!)?.location.route.matches.at(-1)?.id).toBe(
      'home'
    );
    expect(router.entry(second!)?.location.route.matches.at(-1)?.id).toBe(
      'agents'
    );
    expectSelection('Home');
    focus(second!);
    expectSelection('Agents');
    press('Home');
    expect(history.read().path).toBe('/home/~/home');
    expect(router.entry(first!)?.location.route.matches.at(-1)?.id).toBe(
      'home'
    );
    expect(router.entry(second!)?.location.route.matches.at(-1)?.id).toBe(
      'home'
    );
    expectSelection('Home');
    focus(first!);
    press('Agents');
    expect(history.read().path).toBe('/agents/~/home');
    expectSelection('Agents');
    focus(second!);
    expectSelection('Home');
  });

  it('does not reclaim the highlight when Settings becomes active again', () => {
    const { router, history } = setup('/settings');
    expectSelection();
    press('Agents');
    expect(history.read().path).toBe('/agents');
    expectSelection('Agents');

    // Settings opens from outside the rail list (the gear, a hotkey).
    router.navigatePane(router.panes()[0]!, '/settings');
    expect(history.read().path).toBe('/settings');
    expectSelection();
  });
});
