import { AnalyticsContextProvider } from '@app/lib/analytics/analytics-context';
import {
  createMemoryHistory,
  createMemoryPaneStore,
  createSplitRouter,
  defineRoute,
  defineRoutes,
  SplitRouter,
  useBeforeLeave,
  useNavigate,
} from '@app/lib/split-router';
import { ChannelsContextProvider } from '@core/context/channels';
import { EmailLinksContextProvider } from '@core/context/emailLinks';
import { QuickAccessContextProvider } from '@core/context/quickAccess/context';
import { UserContextProvider } from '@core/context/user';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import '@fontsource-variable/inter';
import '../../../index.css';
import { recipientEntityMapper } from '@core/user';
import { fireAndForget } from '@core/util/fireAndForget';
import type { DateSelectArg } from '@fullcalendar/core';
import { Button, confirmDialog, ImperativeDialogHost } from '@ui';
import { createMemo, createSignal, getOwner, onCleanup, Show } from 'solid-js';
import { render } from 'solid-js/web';
import {
  CalendarGrid,
  type CalendarGridHandle,
} from '../../calendar/components/CalendarGrid';
import { createCalendarEventFormController } from '../../calendar/components/composer/create-calendar-event-form-controller';
import {
  EventForm,
  type EventFormProps,
} from '../../calendar/components/composer/EventForm';

import {
  calendarEventToEditorInitialValues,
  calendarSelectionToEditorInitialValues,
  defaultEditorInitialValues,
  type EventEditorSubmitValues,
} from '../../calendar/components/composer/event-form-model';
import type { CalendarEvent } from '../../calendar/types';
import { macroLightTheme } from '../../theme/themes/macro-light';
import { themeCssVars } from '../../theme/utils/themeColorTokens';
import { CalendarEditorSurface } from '../components/calendar-editor-surface';
import { calendarSelectionAnchor } from '../primitives/calendar-editor-anchor';
import { createCalendarDraftDismissal } from '../primitives/create-calendar-draft-dismissal';
import {
  type CalendarEditorDraft,
  type CalendarEditorPresentation,
  createCalendarEditor,
} from '../primitives/create-calendar-editor';

for (const [key, value] of Object.entries(themeCssVars(macroLightTheme)))
  document.documentElement.style.setProperty(key, value);

// Match the application bootstrap so touch sizing is exercised in the fixture.
document.documentElement.dataset.touchDevice = String(isTouchDevice());

const exampleEvent: CalendarEvent = {
  id: 'fixture-occurrence',
  eventId: 'fixture-event',
  occurrenceKey: '2030-10-21T10:00:00',
  isCancelled: false,
  isReadOnly: false,
  eventType: 'default',
  calendarId: 'personal',
  sourceCalendarIds: ['personal'],
  recurrenceLines: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
  attendees: [],
  title: 'Weekly design review',
  description: 'Existing agenda',
  location: 'Design studio',
  start: '2030-10-21T10:00:00',
  end: '2030-10-21T11:00:00',
  allDay: false,
  calendar: {
    id: 'personal',
    name: 'Personal',
    color: '#4285f4',
    isPrimary: true,
  },
  visibleCalendars: [],
};
function FixtureRouter() {
  const calendar = defineRoute({
    id: 'calendar',
    path: 'calendar',
    component: Fixture,
  });
  const away = defineRoute({
    id: 'away',
    path: 'away',
    component: () => <p>Left calendar</p>,
  });
  const router = createSplitRouter({
    history: createMemoryHistory('/calendar'),
    routes: defineRoutes({
      definitions: [calendar, away],
      defaultRoute: () => ({ matches: [{ id: 'calendar', params: {} }] }),
    }),
    paneStore: createMemoryPaneStore(),
    policy: {
      placeNewPane: () => ({ insertAt: 0 }),
      closeAction: () => ({ type: 'remove' }),
      activate: () => {},
    },
  });
  onCleanup(() => router.dispose());
  return (
    <SplitRouter.Root router={router}>
      <SplitRouter.Outlet pane={router.panes()[0]} />
    </SplitRouter.Root>
  );
}
function Fixture() {
  const composer = createCalendarEditor();
  const navigate = useNavigate();
  const draftPreview = createMemo(() => {
    const preview = composer.preview();
    if (!preview) return;
    const time = preview.time;
    return {
      title: preview.title,
      color: preview.color ?? '#4285f4',
      start: time.kind === 'allDay' ? time.startDate : time.startsAt,
      end: time.kind === 'allDay' ? time.endDate : time.endsAt,
      allDay: time.kind === 'allDay',
    };
  });
  const [boundary, setBoundary] = createSignal<HTMLDivElement>();
  const [period, setPeriod] = createSignal(0);
  const [grid, setGrid] = createSignal<CalendarGridHandle>();
  const [month, setMonth] = createSignal(false);
  let latestSelection: DateSelectArg | undefined;
  const [submitted, setSubmitted] = createSignal<{
    values: EventEditorSubmitValues;
    scope?: string;
  }>();
  const openSlot = (start = '2030-10-21T10:00:00') => {
    const host = grid()?.element();
    const day = host
      ?.querySelector(`.fc-timegrid-col[data-date="${start.slice(0, 10)}"]`)
      ?.getBoundingClientRect();
    const time = host
      ?.querySelector(
        `.fc-timegrid-slot[data-time="${start.slice(11, 16)}:00"]`
      )
      ?.getBoundingClientRect();
    const bounds = boundary()?.getBoundingClientRect();
    fireAndForget(
      composer.replace({
        anchor: {
          rect: new DOMRect(
            day?.left ?? (bounds?.left ?? 0) + 80,
            time?.top ?? (bounds?.top ?? 0) + 80,
            day?.width ?? 120,
            (time?.height ?? 24) * 2
          ),
        },
        initialValues: defaultEditorInitialValues(new Date(start)),
      }),
      'calendar-editor-fixture'
    );
  };
  const openExample = () => {
    grid()?.api()?.gotoDate(new Date(exampleEvent.start));
    const element = grid()?.eventElements.get(exampleEvent.id);
    composer.open({
      event: exampleEvent,
      anchor: element
        ? { element, rect: element.getBoundingClientRect() }
        : undefined,
    });
  };

  return (
    <div class="flex h-dvh flex-col bg-page p-4 text-ink">
      <ImperativeDialogHost />
      <header class="flex shrink-0 gap-2 pb-4">
        <Button onClick={() => composer.open({}, 'sidebar')}>
          Create event
        </Button>
        <Button onClick={() => navigate('/away')}>Leave calendar</Button>
        <Button
          onClick={() => {
            grid()?.api()?.prev();
            setPeriod((value) => value - 1);
          }}
        >
          Previous week
        </Button>
        <Button
          onClick={() => {
            grid()?.api()?.next();
            setPeriod((value) => value + 1);
          }}
        >
          Next week
        </Button>
        <Button
          onClick={() => {
            const next = !month();
            setMonth(next);
            grid()
              ?.api()
              ?.changeView(next ? 'dayGridMonth' : 'timeGridWeek');
          }}
        >
          Change period
        </Button>
        <span>Week {period()}</span>
        <output aria-label="Saved event" class="sr-only">
          {JSON.stringify(submitted())}
        </output>
      </header>
      <div
        ref={setBoundary}
        class="relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-edge-muted bg-panel"
      >
        <main
          class="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden"
          aria-label="Calendar grid"
        >
          <div class="flex shrink-0 flex-wrap gap-2 p-2">
            <Button onClick={() => openSlot()}>Select 10 AM</Button>
            <Button onClick={() => openSlot('2030-10-21T14:00:00')}>
              Select another timeslot
            </Button>
            <Button onClick={openExample}>Edit example event</Button>
          </div>
          <div class="min-h-0 flex-1">
            <CalendarGrid
              initialDate={new Date('2030-10-21T10:00:00')}
              events={[exampleEvent]}
              eventsById={new Map([[exampleEvent.id, exampleEvent]])}
              draft={draftPreview()}
              settings={{
                initialView: 'timeGridWeek',
                showWeekends: true,
                weekStartsOn: 0,
                timeFormat: '12-hour',
                useNarrowDayHeaders: false,
                useNarrowEventContent: false,
              }}
              selection={{
                color: '#4285f4',
                onEventSelect: (event, element) =>
                  composer.open({
                    event,
                    anchor: { element, rect: element.getBoundingClientRect() },
                  }),
                onDateSelect: (selection) => {
                  latestSelection = selection;
                  const anchor = calendarSelectionAnchor(selection);
                  const openSelection = async () => {
                    await composer.replace({
                      anchor,
                      initialValues:
                        calendarSelectionToEditorInitialValues(selection),
                      onClose: () => {
                        if (latestSelection === selection)
                          selection.view.calendar.unselect();
                      },
                    });
                    selection.view.calendar.unselect();
                  };
                  fireAndForget(openSelection(), 'calendar-grid-fixture');
                },
              }}
            >
              {(handle) => {
                setGrid(handle);
                return null;
              }}
            </CalendarGrid>
          </div>
        </main>
        <Show keyed when={composer.draft()}>
          {(draft) => (
            <Show when={boundary()}>
              {(element) => (
                <FixtureEditor
                  boundary={element()}
                  draft={draft}
                  anchor={grid()?.draftElement()}
                  surface={composer.surface()}
                  onMoveToSidebar={composer.moveToSidebar}
                  onMoveToPopover={composer.moveToPopover}
                  registerBeforeReplace={composer.registerBeforeReplace}
                  registerPreview={composer.registerPreview}
                  onClose={composer.close}
                  onSubmit={(values, scope) => setSubmitted({ values, scope })}
                />
              )}
            </Show>
          )}
        </Show>
      </div>
    </div>
  );
}

function FixtureEditor(props: {
  boundary: HTMLElement;
  draft: CalendarEditorDraft;
  anchor?: HTMLElement;
  surface: CalendarEditorPresentation;
  onMoveToSidebar: () => void;
  onMoveToPopover: () => void;
  registerBeforeReplace: ReturnType<
    typeof createCalendarEditor
  >['registerBeforeReplace'];
  onClose: () => void;
  registerPreview: ReturnType<typeof createCalendarEditor>['registerPreview'];
  onSubmit: EventFormProps['onSubmit'];
}) {
  const owner = getOwner();
  const [pending, setPending] = createSignal(false);
  const calendars = [
    { id: 'personal', label: 'Personal', color: '#4285f4', isPrimary: true },
    { id: 'work', label: 'Work', color: '#9c27b0' },
  ];
  const guests = [
    recipientEntityMapper('user')({
      id: 'macro|ada@example.com',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
    }),
  ];
  const controller = createCalendarEventFormController({
    initialValue:
      (props.draft.event
        ? calendarEventToEditorInitialValues(props.draft.event)
        : undefined) ??
      props.draft.initialValues ??
      defaultEditorInitialValues(new Date('2030-10-21T10:00:00')),
    isEdit: props.draft.event !== undefined,
    calendarOptions: () => calendars,
    guestOptions: () => guests,
  });
  onCleanup(
    props.registerPreview(() => {
      if (props.draft.event) return;
      const time = controller.eventTime();
      return time
        ? {
            title: controller.state().title,
            color: controller.selectedCalendarOption()?.color,
            time,
          }
        : undefined;
    })
  );
  const mayDismiss = createCalendarDraftDismissal({
    dirty: controller.isDirty,
    pending,
    confirmDiscard: () =>
      confirmDialog(
        {
          title: 'Discard event changes?',
          body: 'Your unsaved changes will be lost.',
          confirmLabel: 'Discard',
          cancelLabel: 'Keep editing',
          tone: 'danger',
        },
        { owner }
      ),
  });
  onCleanup(props.registerBeforeReplace(mayDismiss));
  useBeforeLeave(() => mayDismiss(props.draft.event === undefined));
  const close = async () => {
    if (await mayDismiss()) props.onClose();
  };
  const requestClose = () => fireAndForget(close(), 'calendar-editor-fixture');
  return (
    <CalendarEditorSurface
      {...props}
      pending={pending()}
      onClose={requestClose}
    >
      <output aria-label="Draft date range" class="sr-only">
        {JSON.stringify({
          start: controller.state().start,
          end: controller.state().end,
          allDay: controller.state().allDay,
        })}
      </output>
      <EventForm
        controller={controller}
        macroCallsEnabled
        isEdit={props.draft.event !== undefined}
        disabledFields={
          props.draft.event
            ? {
                calendar: true,
                guests: true,
                conference: true,
                reminders: true,
              }
            : undefined
        }
        showRecurringEditNotice={Boolean(
          props.draft.event?.recurrenceLines.length
        )}
        pending={pending()}
        onCancel={requestClose}
        onSubmit={(values, scope) => {
          if (new URLSearchParams(location.search).has('pending-save')) {
            setPending(true);
            return;
          }
          props.onSubmit(values, scope);
          props.onClose();
        }}
      />
    </CalendarEditorSurface>
  );
}

const root = document.getElementById('root');
if (root)
  render(
    () => (
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { enabled: false, retry: false } },
          })
        }
      >
        <UserContextProvider>
          <EmailLinksContextProvider>
            <ChannelsContextProvider>
              <AnalyticsContextProvider>
                <QuickAccessContextProvider
                  value={{
                    useList: () => ({
                      items: () => [],
                      totalCount: () => 0,
                      hasMore: () => false,
                      isLoading: () => false,
                      isLoadingMore: () => false,
                      loadMore: async () => {},
                    }),
                    usesRecordSelection: () => false,
                    usesSearchProjection: () => false,
                    isLoading: () => false,
                    refresh: () => {},
                    getById: () => undefined,
                  }}
                >
                  <FixtureRouter />
                </QuickAccessContextProvider>
              </AnalyticsContextProvider>
            </ChannelsContextProvider>
          </EmailLinksContextProvider>
        </UserContextProvider>
      </QueryClientProvider>
    ),
    root
  );
