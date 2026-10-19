import { AnalyticsContextProvider } from '@app/lib/analytics/analytics-context';
import { ChannelsContextProvider } from '@core/context/channels';
import { EmailLinksContextProvider } from '@core/context/emailLinks';
import { QuickAccessContextProvider } from '@core/context/quickAccess/context';
import { UserContextProvider } from '@core/context/user';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import '@fontsource-variable/inter';
import '../../../index.css';
import { recipientEntityMapper } from '@core/user';
import { fireAndForget } from '@core/util/fireAndForget';
import { Button, confirmDialog, ImperativeDialogHost } from '@ui';
import { createSignal, getOwner, Show } from 'solid-js';
import { render } from 'solid-js/web';
import {
  CalendarGrid,
  type CalendarGridHandle,
} from '../../calendar/components/CalendarGrid';
import { createCalendarEventFormController } from '../../calendar/components/composer/create-calendar-event-form-controller';
import { EventForm } from '../../calendar/components/composer/EventForm';
import {
  calendarSelectionToEditorInitialValues,
  defaultEditorInitialValues,
} from '../../calendar/components/composer/event-form-model';
import { macroLightTheme } from '../../theme/themes/macro-light';
import { themeCssVars } from '../../theme/utils/themeColorTokens';
import { CalendarCreationSurface } from '../components/calendar-creation-surface';
import {
  type CalendarCreationDraft,
  createCalendarCreation,
} from '../primitives/create-calendar-creation';
import { createCalendarDraftDismissal } from '../primitives/create-calendar-draft-dismissal';

for (const [key, value] of Object.entries(themeCssVars(macroLightTheme)))
  document.documentElement.style.setProperty(key, value);

function Fixture() {
  const creation = createCalendarCreation();
  const [boundary, setBoundary] = createSignal<HTMLDivElement>();
  const [period, setPeriod] = createSignal(0);
  const [grid, setGrid] = createSignal<CalendarGridHandle>();
  const [month, setMonth] = createSignal(false);
  const openSlot = (event: MouseEvent) =>
    creation.open({
      initialValues: defaultEditorInitialValues(
        new Date('2030-10-21T10:00:00')
      ),
      anchor: { x: event.clientX, y: event.clientY, width: 80, height: 30 },
    });

  return (
    <div class="flex h-dvh flex-col bg-page p-4 text-ink">
      <ImperativeDialogHost />
      <header class="flex shrink-0 gap-2 pb-4">
        <Button onClick={() => creation.open()}>Create event</Button>
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
      </header>
      <div
        ref={setBoundary}
        class="relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-edge-muted bg-panel"
      >
        <main
          class="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden"
          aria-label="Calendar grid"
        >
          <div class="flex shrink-0 gap-2 p-2">
            <Button onClick={openSlot}>Select 10 AM</Button>
            <Button onClick={openSlot}>Select another timeslot</Button>
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
                allowDateSelection: () => !creation.draft(),
                onDateSelect: (selection) => {
                  const pointer = selection.jsEvent;
                  creation.open({
                    initialValues:
                      calendarSelectionToEditorInitialValues(selection),
                    anchor: {
                      x: pointer?.clientX ?? 200,
                      y: pointer?.clientY ?? 200,
                      width: 1,
                      height: 1,
                    },
                    onClose: () => selection.view.calendar.unselect(),
                  });
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
        <Show keyed when={creation.draft()}>
          {(draft) => (
            <Show when={boundary()}>
              {(element) => (
                <FixtureEditor
                  boundary={element()}
                  draft={draft}
                  surface={creation.surface()}
                  onMoveToSidebar={creation.moveToSidebar}
                  onClose={creation.close}
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
  draft: CalendarCreationDraft;
  surface: 'popover' | 'sidebar';
  onMoveToSidebar: () => void;
  onClose: () => void;
}) {
  const owner = getOwner();
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
      props.draft.initialValues ??
      defaultEditorInitialValues(new Date('2030-10-21T10:00:00')),
    calendarOptions: () => calendars,
    guestOptions: () => guests,
  });
  const mayDismiss = createCalendarDraftDismissal({
    dirty: controller.isDirty,
    pending: () => false,
    confirmDiscard: () =>
      confirmDialog(
        {
          title: 'You still have remaining changes',
          body: 'Closing this event will discard your changes.',
          confirmLabel: 'Discard',
          cancelLabel: 'Keep editing',
          tone: 'danger',
        },
        { owner }
      ),
  });
  const close = async () => {
    if (await mayDismiss()) props.onClose();
  };
  const requestClose = () =>
    fireAndForget(close(), 'calendar-creation-fixture');
  return (
    <CalendarCreationSurface {...props} pending={false} onClose={requestClose}>
      <EventForm
        layout="details"
        controller={controller}
        macroCallsEnabled
        pending={false}
        onCancel={requestClose}
        onSubmit={() => props.onClose()}
      />
    </CalendarCreationSurface>
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
