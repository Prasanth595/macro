import { createCalendarEventFormController } from '@app/features/calendar/components/composer/create-calendar-event-form-controller';
import { EventForm } from '@app/features/calendar/components/composer/EventForm';
import { defaultEditorInitialValues } from '@app/features/calendar/components/composer/event-form-model';
import { useEventEditor } from '@app/features/calendar/hooks/use-event-editor';
import { useQuickCallsFlag } from '@app/features/meetings/use-quick-calls-flag';
import { useBeforeLeave } from '@app/lib/split-router';
import { isMobile } from '@core/mobile/isMobile';
import { fireAndForget } from '@core/util/fireAndForget';
import { Telemetry } from '@macro-inc/observability';
import { confirmDialog } from '@ui';
import {
  type Accessor,
  createMemo,
  getOwner,
  onCleanup,
  Show,
  Suspense,
} from 'solid-js';
import { CalendarCreationSurface } from '../components/calendar-creation-surface';
import { useCalendarCreation } from '../context/calendar-creation-context';
import type { CalendarCreationDraft } from '../primitives/create-calendar-creation';
import { createCalendarDraftDismissal } from '../primitives/create-calendar-draft-dismissal';

/** The controller and mutation state survive every presentation change. */
export function CalendarEventCreation(props: { boundary: HTMLElement }) {
  const creation = useCalendarCreation();
  return (
    <Show keyed when={creation.draft()}>
      {(draft) => (
        <Suspense
          fallback={
            <CalendarCreationLoading boundary={props.boundary} draft={draft} />
          }
        >
          <CalendarCreationReady boundary={props.boundary} draft={draft} />
        </Suspense>
      )}
    </Show>
  );
}

function CalendarCreationReady(props: {
  boundary: HTMLElement;
  draft: CalendarCreationDraft;
}) {
  const quickCalls = useQuickCallsFlag();
  const ready = createMemo(
    (resolved) => resolved || !quickCalls().loading,
    false
  );
  return (
    <Show when={ready()} fallback={<CalendarCreationLoading {...props} />}>
      <CalendarCreationEditor
        {...props}
        macroCallsEnabled={() => quickCalls().enabled && !quickCalls().loading}
      />
    </Show>
  );
}

function CalendarCreationLoading(props: {
  boundary: HTMLElement;
  draft: CalendarCreationDraft;
}) {
  const creation = useCalendarCreation();
  return (
    <CalendarCreationSurface
      {...props}
      surface={creation.surface()}
      pending={false}
      onClose={creation.close}
      onMoveToSidebar={creation.moveToSidebar}
    >
      <p role="status" class="p-4">
        Loading event…
      </p>
    </CalendarCreationSurface>
  );
}

function CalendarCreationEditor(props: {
  boundary: HTMLElement;
  draft: CalendarCreationDraft;
  macroCallsEnabled: Accessor<boolean>;
}) {
  const creation = useCalendarCreation();
  const owner = getOwner();
  const opener = document.activeElement;
  let saved = false;
  const editor = useEventEditor({
    event: () => undefined,
    macroCallsEnabled: props.macroCallsEnabled,
    onSaved: () => {
      saved = true;
      creation.close();
    },
  });
  const initial =
    props.draft.initialValues ??
    defaultEditorInitialValues(new Date(), props.macroCallsEnabled());
  const controller = createCalendarEventFormController({
    initialValue:
      initial.conference === 'macro' && !props.macroCallsEnabled()
        ? { ...initial, conference: 'none' }
        : initial,
    calendarOptions: editor.calendarOptions,
    guestOptions: editor.guestOptions,
  });
  const mayDismiss = createCalendarDraftDismissal({
    dirty: controller.isDirty,
    pending: editor.pending,
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
    if (await mayDismiss()) creation.close();
  };
  const requestClose = () => fireAndForget(close(), 'calendar-event-creation');
  useBeforeLeave(() => mayDismiss());
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!controller.isDirty() && !editor.pending()) return;
    event.preventDefault();
    event.returnValue = '';
  };
  window.addEventListener('beforeunload', beforeUnload);
  onCleanup(() => {
    window.removeEventListener('beforeunload', beforeUnload);
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  });

  return (
    <CalendarCreationSurface
      boundary={props.boundary}
      draft={props.draft}
      surface={creation.surface()}
      pending={editor.pending()}
      onClose={requestClose}
      onMoveToSidebar={creation.moveToSidebar}
    >
      <EventForm
        layout="details"
        controller={controller}
        macroCallsEnabled={props.macroCallsEnabled()}
        isEdit={editor.eventCreated()}
        saveError={editor.saveError()}
        disabledFields={editor.disabledFields()}
        pending={editor.pending()}
        onCalendarChange={props.draft.onCalendarChange}
        onCancel={requestClose}
        onSubmit={(values, scope) =>
          fireAndForget(
            Telemetry.span('calendar.event.create', async (span) => {
              span.setAttr(
                'calendar.surface',
                isMobile() ? 'sheet' : creation.surface()
              );
              if (values.calendarId)
                span.setAttr('calendar.id', values.calendarId);
              await editor.save(values, scope);
              span.setAttr('calendar.saved', saved);
              if (!saved)
                span.error(editor.saveError() ?? 'Event creation failed');
            }),
            'calendar-event-creation'
          )
        }
      />
    </CalendarCreationSurface>
  );
}
