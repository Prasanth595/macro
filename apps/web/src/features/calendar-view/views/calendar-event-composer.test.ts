import {
  createMemoryHistory,
  createMemoryPaneStore,
  createSplitRouter,
  defineRoute,
  defineRoutes,
  SplitRouter,
} from '@app/lib/split-router';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createComponent, onCleanup } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventFormProps } from '../../calendar/components/composer/EventForm';
import {
  CalendarEditorProvider,
  useCalendarEditor,
} from '../context/calendar-editor-context';
import type { CalendarEditorPresentation } from '../primitives/create-calendar-editor';
import { CalendarEventComposer } from './calendar-event-composer';

const { confirmDiscard } = vi.hoisted(() => ({ confirmDiscard: vi.fn() }));

vi.mock('@ui', async (original) => ({
  ...(await original<typeof import('@ui')>()),
  confirmDialog: confirmDiscard,
}));
vi.mock('@app/features/meetings/use-quick-calls-flag', () => ({
  useQuickCallsFlag: () => () => ({ enabled: false, loading: false }),
}));
vi.mock('@app/features/calendar/hooks/use-event-editor', () => ({
  useEventEditor: () => ({
    initialValues: () => undefined,
    calendarOptions: () => [{ id: 'personal', label: 'Personal' }],
    guestOptions: () => [],
    pending: () => false,
    saveError: () => undefined,
    disabledFields: () => ({}),
    showRecurringEditNotice: () => false,
    eventCreated: () => false,
  }),
}));
vi.mock('@app/features/calendar/components/composer/EventForm', () => ({
  EventForm: (props: EventFormProps) => {
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Title');
    input.value = props.controller.state().title;
    input.addEventListener('input', () => {
      props.controller.setField('title', input.value);
    });
    return input;
  },
}));

function setup(presentation: CalendarEditorPresentation) {
  function Editor() {
    const composer = useCalendarEditor();
    composer.open({}, presentation);
    return createComponent(CalendarEventComposer, { boundary: document.body });
  }
  const calendar = defineRoute({
    id: 'calendar',
    path: 'calendar',
    component: () =>
      createComponent(CalendarEditorProvider, {
        get children() {
          return createComponent(Editor, {});
        },
      }),
  });
  const home = defineRoute({
    id: 'home',
    path: 'home',
    component: () => document.createTextNode('Home'),
  });
  const history = createMemoryHistory('/calendar');
  const router = createSplitRouter({
    history,
    routes: defineRoutes({
      definitions: [calendar, home],
      defaultRoute: () => ({ matches: [{ id: 'calendar', params: {} }] }),
    }),
    paneStore: createMemoryPaneStore(),
    policy: {
      placeNewPane: () => ({ insertAt: 0 }),
      closeAction: () => ({ type: 'remove' }),
      activate: () => {},
    },
  });
  render(() => {
    onCleanup(() => router.dispose());
    return createComponent(SplitRouter.Root, {
      router,
      get children() {
        return createComponent(SplitRouter.Outlet, { pane: router.panes()[0] });
      },
    });
  });
  return { history, router };
}

afterEach(() => {
  cleanup();
  confirmDiscard.mockReset();
});

describe.each(['popover', 'sidebar'] as const)(
  '%s navigation protection',
  (presentation) => {
    it('protects a new event even before its initial fields are edited', async () => {
      const { history, router } = setup(presentation);
      confirmDiscard.mockResolvedValueOnce(false);
      const pane = router.panes()[0];
      if (!pane) throw new Error('Expected a calendar pane');
      await router.navigatePane(pane, '/home');
      expect(confirmDiscard).toHaveBeenCalledOnce();
      expect(history.read().path).toBe('/calendar');
      expect(screen.getByLabelText('Title')).toBeTruthy();
    });

    it('retains the draft after Keep editing and leaves only after Discard', async () => {
      const { history, router } = setup(presentation);
      const title = screen.getByLabelText('Title');
      fireEvent.input(title, { target: { value: 'Keep my unsaved event' } });
      confirmDiscard.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const pane = router.panes()[0];
      if (!pane) throw new Error('Expected a calendar pane');

      await router.navigatePane(pane, '/home');
      expect(confirmDiscard).toHaveBeenCalledOnce();
      expect(confirmDiscard.mock.calls[0][0]).toMatchObject({
        title: 'Discard event changes?',
        cancelLabel: 'Keep editing',
        confirmLabel: 'Discard',
      });
      expect(history.read().path).toBe('/calendar');
      expect(screen.getByLabelText('Title')).toHaveProperty(
        'value',
        'Keep my unsaved event'
      );

      await router.navigatePane(pane, '/home');
      expect(confirmDiscard).toHaveBeenCalledTimes(2);
      expect(history.read().path).toBe('/home');
      expect(screen.queryByLabelText('Title')).toBeNull();
    });
  }
);
