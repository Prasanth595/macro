import {
  createMemoryHistory,
  createMemoryPaneStore,
  createSplitRouter,
  SplitRouter,
} from '@app/lib/split-router';
import {
  appRoute,
  calendarSplitRoute,
  homeSplitRoute,
} from '@app/routes/routes';
import { navigateToSidebarView } from '@components/app/app-sidebar/sidebar';
import { createSplitLayout } from '@components/app/split-layout/layoutManager';
import {
  resolveContentLocation,
  splitContentFromLocation,
} from '@components/app/split-layout/split-router/legacy-route';
import type { BlockOrchestrator } from '@core/orchestrator';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { createComponent, onCleanup } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CalendarEditorProvider,
  useCalendarEditor,
} from '../context/calendar-editor-context';
import { CalendarEventComposer } from './calendar-event-composer';

const { confirmDiscard } = vi.hoisted(() => ({ confirmDiscard: vi.fn() }));

vi.mock('@ui', async (original) => ({
  ...(await original<typeof import('@ui')>()),
  confirmDialog: confirmDiscard,
}));
vi.mock('@app/features/meetings/use-quick-calls-flag', () => ({
  useQuickCallsFlag: () => () => ({ enabled: false, loading: true }),
}));
vi.mock('@app/features/calendar/hooks/use-event-editor', () => ({
  useEventEditor: () => {
    throw new Error(
      'The editor must not mount before its flags finish loading'
    );
  },
}));
vi.mock('@app/features/calendar/components/composer/EventForm', () => ({
  EventForm: () => null,
}));
vi.mock('@components/app/split-layout/componentRegistry', () => ({
  resolveComponent: vi.fn(() => ({ element: () => null })),
}));
vi.mock('@core/constant/allBlocks', () => ({
  isBlockAlias: () => false,
  resolveBlockAlias: (type: string) => type,
}));
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

function setup(presentation: 'popover' | 'sidebar') {
  function Editor() {
    useCalendarEditor().open({}, presentation);
    return createComponent(CalendarEventComposer, { boundary: document.body });
  }
  const calendar = {
    ...calendarSplitRoute,
    component: () =>
      createComponent(CalendarEditorProvider, {
        get children() {
          return createComponent(Editor, {});
        },
      }),
  };
  const home = {
    ...homeSplitRoute,
    component: () => document.createTextNode('Home'),
  };
  const history = createMemoryHistory('/calendar/week');
  const router = createSplitRouter({
    history,
    routes: {
      definitions: [
        {
          ...appRoute,
          component: () => createComponent(SplitRouter.Outlet, {}),
          children: [calendar, home],
        },
      ],
      defaultRoute: () => ({
        matches: [
          { id: appRoute.id, params: {} },
          { id: calendar.id, params: { period: 'timeGridWeek' } },
        ],
      }),
    },
    paneStore: createMemoryPaneStore(),
    policy: {
      placeNewPane: () => ({ insertAt: 0 }),
      closeAction: () => ({ type: 'remove' }),
      activate: () => {},
    },
  });
  let manager: ReturnType<typeof createSplitLayout>;
  render(() => {
    manager = createSplitLayout({} as BlockOrchestrator, {
      router,
      toLocation: (content) => resolveContentLocation(router.routes, content),
      toContent: splitContentFromLocation,
    });
    onCleanup(() => router.dispose());
    return createComponent(SplitRouter.Root, {
      router,
      get children() {
        return createComponent(SplitRouter.Outlet, { pane: router.panes()[0] });
      },
    });
  });
  const navigate = async () => {
    navigateToSidebarView({
      viewId: 'home',
      shiftKey: false,
      openWithSplit: manager.openWithSplit,
      referredFrom: 'sidebar',
    });
    await router.settled();
  };
  return { history, navigate };
}

afterEach(() => {
  cleanup();
  confirmDiscard.mockReset();
});

describe.each(['popover', 'sidebar'] as const)(
  '%s loading navigation protection',
  (presentation) => {
    it('keeps the loading draft until sidebar navigation is confirmed', async () => {
      const { history, navigate } = setup(presentation);
      expect(screen.getByRole('status').textContent).toBe('Loading event…');
      confirmDiscard.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await navigate();
      expect(confirmDiscard).toHaveBeenCalledOnce();
      expect(history.read().path).toBe('/calendar/week');
      expect(screen.getByRole('status')).toBeTruthy();

      const unload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(unload);
      expect(unload.defaultPrevented).toBe(true);

      await navigate();
      expect(confirmDiscard).toHaveBeenCalledTimes(2);
      expect(history.read().path).toBe('/home');
      expect(screen.queryByRole('status')).toBeNull();
    });
  }
);
