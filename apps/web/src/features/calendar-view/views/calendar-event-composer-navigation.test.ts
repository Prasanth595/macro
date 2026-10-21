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
import { setGlobalSplitManager } from '@app/signal/splitLayout';
import { ListNav } from '@components/app/sidebar-next/list-nav';
import { SIDEBAR_NEXT_NAV_ITEMS } from '@components/app/sidebar-next/nav-items';
import { SidebarPrefsProvider } from '@components/app/sidebar-next/use-sidebar-prefs';
import { createSplitLayout } from '@components/app/split-layout/layoutManager';
import {
  resolveContentLocation,
  splitContentFromLocation,
} from '@components/app/split-layout/split-router/legacy-route';
import type { BlockOrchestrator } from '@core/orchestrator';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { ImperativeDialogHost } from '@ui';
import { createComponent, onCleanup } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventFormProps } from '../../calendar/components/composer/EventForm';
import {
  CalendarEditorProvider,
  useCalendarEditor,
} from '../context/calendar-editor-context';
import { CalendarEventComposer } from './calendar-event-composer';

const flags = vi.hoisted(() => ({ loading: true }));

vi.mock('@app/lib/analytics/analytics-context', () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));
vi.mock('@app/features/meetings/use-quick-calls-flag', () => ({
  useQuickCallsFlag: () => () => ({ enabled: false, loading: flags.loading }),
}));
vi.mock('@app/features/calendar/hooks/use-event-editor', () => ({
  useEventEditor: () => {
    if (flags.loading)
      throw new Error(
        'The editor must not mount before its flags finish loading'
      );
    return {
      initialValues: () => undefined,
      calendarOptions: () => [{ id: 'personal', label: 'Personal' }],
      guestOptions: () => [],
      pending: () => false,
      saveError: () => undefined,
      disabledFields: () => ({}),
      showRecurringEditNotice: () => false,
      eventCreated: () => false,
    };
  },
}));
vi.mock('@app/features/calendar/components/composer/EventForm', () => ({
  EventForm: (props: EventFormProps) => {
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Title');
    input.value = props.controller.state().title;
    input.addEventListener('input', () =>
      props.controller.setField('title', input.value)
    );
    return input;
  },
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

function setup() {
  function Editor() {
    useCalendarEditor().open({}, 'sidebar');
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
    component: () => document.createTextNode('Home view'),
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
  render(() => {
    const manager = createSplitLayout({} as BlockOrchestrator, {
      router,
      toLocation: (content) => resolveContentLocation(router.routes, content),
      toContent: splitContentFromLocation,
    });
    const calendarSplit = manager.splits()[0];
    if (!calendarSplit) throw new Error('Expected a calendar split');
    manager.activateSplit(calendarSplit.id);
    setGlobalSplitManager(manager);
    onCleanup(() => {
      setGlobalSplitManager(undefined);
      router.dispose();
    });
    return createComponent(SplitRouter.Root, {
      router,
      get children() {
        return [
          createComponent(SidebarPrefsProvider, {
            get children() {
              return createComponent(ListNav, {
                item: SIDEBAR_NEXT_NAV_ITEMS.find(
                  (item) => item.id === 'home'
                )!,
              });
            },
          }),
          createComponent(SplitRouter.Outlet, { pane: router.panes()[0] }),
          createComponent(ImperativeDialogHost, {}),
        ];
      },
    });
  });
  return { history, router };
}

afterEach(() => {
  cleanup();
  setGlobalSplitManager(undefined);
  flags.loading = true;
});

describe('calendar creation draft sidebar navigation', () => {
  it.each(['loading', 'ready'] as const)(
    'keeps the %s draft on Keep editing and navigates only on Discard',
    async (state) => {
      flags.loading = state === 'loading';
      const { history, router } = setup();
      const home = screen.getByRole('button', { name: 'Home' });
      if (state === 'loading') {
        expect(screen.getByRole('status').textContent).toBe('Loading event…');
      } else {
        fireEvent.input(screen.getByLabelText('Title'), {
          target: { value: 'Keep my event' },
        });
      }

      fireEvent.mouseDown(home, { button: 0 });
      fireEvent.click(home, { button: 0, detail: 1 });
      expect(
        screen.getByRole('dialog', { name: 'Discard event changes?' })
      ).toBeTruthy();
      expect(history.read().path).toBe('/calendar/week');
      fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
      await router.settled();
      expect(history.read().path).toBe('/calendar/week');
      if (state === 'loading') {
        expect(screen.getByRole('status').textContent).toBe('Loading event…');
      } else {
        expect(screen.getByLabelText('Title')).toHaveProperty(
          'value',
          'Keep my event'
        );
      }

      fireEvent.mouseDown(home, { button: 0 });
      fireEvent.click(home, { button: 0, detail: 1 });
      expect(
        screen.getByRole('dialog', { name: 'Discard event changes?' })
      ).toBeTruthy();
      expect(history.read().path).toBe('/calendar/week');
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
      await router.settled();
      expect(history.read().path).toBe('/home');
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByLabelText('Title')).toBeNull();
    }
  );
});
