import { AnalyticsContextProvider } from '@app/lib/analytics/analytics-context';
import { ChannelsContextProvider } from '@core/context/channels';
import { EmailLinksContextProvider } from '@core/context/emailLinks';
import { QuickAccessContextProvider } from '@core/context/quickAccess/context';
import { UserContextProvider } from '@core/context/user';
import { isMobile } from '@core/mobile/isMobile';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import '@fontsource-variable/inter';
import '../../../index.css';
import { recipientEntityMapper } from '@core/user';
import { fireAndForget } from '@core/util/fireAndForget';
import type { DateSelectArg } from '@fullcalendar/core';
import { Button, confirmDialog, ImperativeDialogHost } from '@ui';
import { createSignal, getOwner, onCleanup, Show } from 'solid-js';
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
import { EventComposerKindPill } from '../../calendar/components/composer/EventPropertyPills';

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
import { createCalendarDraftDismissal } from '../primitives/create-calendar-draft-dismissal';
import {
  type CalendarEditorDraft,
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
function Fixture() {
  const composer = createCalendarEditor();
  const [boundary, setBoundary] = createSignal<HTMLDivElement>();
  const [period, setPeriod] = createSignal(0);
  const [grid, setGrid] = createSignal<CalendarGridHandle>();
  const [month, setMonth] = createSignal(false);
  let latestSelection: DateSelectArg | undefined;
  const [submitted, setSubmitted] = createSignal<{
    values: EventEditorSubmitValues;
    scope?: string;
  }>();
  const openSlot = (event: MouseEvent, start = '2030-10-21T10:00:00') =>
    fireAndForget(
      composer.replace({
        initialValues: defaultEditorInitialValues(new Date(start)),
        anchor: { x: event.clientX, y: event.clientY, width: 80, height: 30 },
      }),
      'calendar-editor-fixture'
    );

  return (
    <div class="flex h-dvh flex-col bg-page p-4 text-ink">
      <ImperativeDialogHost />
      <header class="flex shrink-0 gap-2 pb-4">
        <Button onClick={() => composer.open()}>Create event</Button>
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
            <Button onClick={(event) => openSlot(event)}>Select 10 AM</Button>
            <Button onClick={(event) => openSlot(event, '2030-10-21T14:00:00')}>
              Select another timeslot
            </Button>
            <Button
              onClick={(event) =>
                composer.open({
                  event: exampleEvent,
                  anchor: event.currentTarget.getBoundingClientRect(),
                })
              }
            >
              Edit example event
            </Button>
          </div>
          <div class="min-h-0 flex-1">
            <CalendarGrid
              initialDate={new Date('2030-10-21T10:00:00')}
              events={[]}
              eventsById={new Map()}
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
                onDateSelect: (selection) => {
                  latestSelection = selection;
                  const pointer = selection.jsEvent;
                  const openSelection = async () => {
                    const opened = await composer.replace({
                      initialValues:
                        calendarSelectionToEditorInitialValues(selection),
                      anchor: {
                        x: pointer?.clientX ?? 200,
                        y: pointer?.clientY ?? 200,
                        width: 1,
                        height: 1,
                      },
                      onClose: () => {
                        if (latestSelection === selection)
                          selection.view.calendar.unselect();
                      },
                    });
                    if (!opened) selection.view.calendar.unselect();
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
                  surface={composer.surface()}
                  registerBeforeReplace={composer.registerBeforeReplace}
                  onMoveToSidebar={composer.moveToSidebar}
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
  surface: 'popover' | 'sidebar';
  registerBeforeReplace: ReturnType<
    typeof createCalendarEditor
  >['registerBeforeReplace'];
  onMoveToSidebar: () => void;
  onClose: () => void;
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
  const close = async () => {
    if (await mayDismiss()) props.onClose();
  };
  const requestClose = () => fireAndForget(close(), 'calendar-editor-fixture');
  return (
    <CalendarEditorSurface
      {...props}
      pending={pending()}
      onClose={requestClose}
      headerStart={
        <EventComposerKindPill
          eventType={controller.state().eventType}
          onChange={controller.setEventKind}
          disabled={pending()}
          readOnly={props.draft.event !== undefined}
          compact
        />
      }
    >
      <EventForm
        showEventKind={false}
        showDateRange={isMobile() || props.surface !== 'popover'}
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
                  <Fixture />
                </QuickAccessContextProvider>
              </AnalyticsContextProvider>
            </ChannelsContextProvider>
          </EmailLinksContextProvider>
        </UserContextProvider>
      </QueryClientProvider>
    ),
    root
  );
