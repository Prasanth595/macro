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
import { CalendarEditorSurface } from '../components/calendar-editor-surface';
import { useCalendarEditor } from '../context/calendar-editor-context';
import { createCalendarDraftDismissal } from '../primitives/create-calendar-draft-dismissal';
import type { CalendarEditorDraft } from '../primitives/create-calendar-editor';

/** The calendar owns the controller and mutation state independently of grid pages. */
export function CalendarEventComposer(props: { boundary: HTMLElement }) {
  const composer = useCalendarEditor();
  return (
    <Show keyed when={composer.draft()}>
      {(draft) => (
        <Suspense
          fallback={
            <CalendarEditorLoading boundary={props.boundary} draft={draft} />
          }
        >
          <CalendarEditorReady boundary={props.boundary} draft={draft} />
        </Suspense>
      )}
    </Show>
  );
}

function CalendarEditorReady(props: {
  boundary: HTMLElement;
  draft: CalendarEditorDraft;
}) {
  const quickCalls = useQuickCallsFlag();
  const ready = createMemo(
    (resolved) => resolved || !quickCalls().loading,
    false
  );
  return (
    <Show when={ready()} fallback={<CalendarEditorLoading {...props} />}>
      <CalendarEditorContent
        {...props}
        macroCallsEnabled={() => quickCalls().enabled && !quickCalls().loading}
      />
    </Show>
  );
}

function CalendarEditorLoading(props: {
  boundary: HTMLElement;
  draft: CalendarEditorDraft;
}) {
  const composer = useCalendarEditor();
  return (
    <CalendarEditorSurface
      {...props}
      surface={composer.surface()}
      onMoveToSidebar={composer.moveToSidebar}
      pending={false}
      onClose={composer.close}
    >
      <p role="status" class="p-4">
        Loading event…
      </p>
    </CalendarEditorSurface>
  );
}

function CalendarEditorContent(props: {
  boundary: HTMLElement;
  draft: CalendarEditorDraft;
  macroCallsEnabled: Accessor<boolean>;
}) {
  const composer = useCalendarEditor();
  const owner = getOwner();
  const opener = document.activeElement;
  let saved = false;
  const editor = useEventEditor({
    event: () => props.draft.event,
    macroCallsEnabled: props.macroCallsEnabled,
    onSaved: () => {
      saved = true;
      composer.close();
    },
  });
  const initial =
    editor.initialValues() ??
    props.draft.initialValues ??
    defaultEditorInitialValues(new Date(), props.macroCallsEnabled());
  const controller = createCalendarEventFormController({
    initialValue:
      !props.draft.event &&
      initial.conference === 'macro' &&
      !props.macroCallsEnabled()
        ? { ...initial, conference: 'none' }
        : initial,
    isEdit: props.draft.event !== undefined,
    calendarOptions: editor.calendarOptions,
    guestOptions: editor.guestOptions,
  });
  const mayDismiss = createCalendarDraftDismissal({
    dirty: controller.isDirty,
    pending: editor.pending,
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
  onCleanup(composer.registerBeforeReplace(mayDismiss));
  const close = async () => {
    if (await mayDismiss()) composer.close();
  };
  const requestClose = () => fireAndForget(close(), 'calendar-event-composer');
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
    <CalendarEditorSurface
      boundary={props.boundary}
      draft={props.draft}
      pending={editor.pending()}
      onClose={requestClose}
      surface={composer.surface()}
      onMoveToSidebar={composer.moveToSidebar}
    >
      <EventForm
        controller={controller}
        macroCallsEnabled={props.macroCallsEnabled()}
        isEdit={props.draft.event !== undefined || editor.eventCreated()}
        saveError={editor.saveError()}
        disabledFields={editor.disabledFields()}
        showRecurringEditNotice={editor.showRecurringEditNotice()}
        pending={editor.pending()}
        onCalendarChange={props.draft.onCalendarChange}
        onCancel={requestClose}
        onSubmit={(values, scope) =>
          fireAndForget(
            Telemetry.span(
              props.draft.event
                ? 'calendar.event.update'
                : 'calendar.event.create',
              async (span) => {
                span.setAttr(
                  'calendar.surface',
                  isMobile() ? 'sheet' : composer.surface()
                );
                if (values.calendarId)
                  span.setAttr('calendar.id', values.calendarId);
                if (props.draft.event)
                  span.setAttr('calendar.event.id', props.draft.event.eventId);
                await editor.save(values, scope);
                span.setAttr('calendar.saved', saved);
                if (!saved)
                  span.error(editor.saveError() ?? 'Event composer failed');
              }
            ),
            'calendar-event-composer'
          )
        }
      />
    </CalendarEditorSurface>
  );
}
