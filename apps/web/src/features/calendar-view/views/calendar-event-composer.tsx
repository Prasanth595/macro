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

type CalendarEditorDismissalState = {
  dirty: Accessor<boolean>;
  pending: Accessor<boolean>;
};

type CalendarEditorProps = {
  boundary: HTMLElement;
  draft: CalendarEditorDraft;
  onClose: () => void;
  registerDismissalState: (state: CalendarEditorDismissalState) => () => void;
};

/** The calendar owns the draft's leave guard even while its form is loading. */
export function CalendarEventComposer(props: { boundary: HTMLElement }) {
  const composer = useCalendarEditor();
  const owner = getOwner();
  let dismissalState: CalendarEditorDismissalState | undefined;
  const registerDismissalState = (state: CalendarEditorDismissalState) => {
    dismissalState = state;
    return () => {
      if (dismissalState === state) dismissalState = undefined;
    };
  };
  const mayDismiss = createCalendarDraftDismissal({
    dirty: () => dismissalState?.dirty() ?? false,
    pending: () => dismissalState?.pending() ?? false,
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
  useBeforeLeave(() => {
    const draft = composer.draft();
    // A selected slot is an unsaved event, even before its form has loaded.
    return !draft || mayDismiss(draft.event === undefined);
  });
  const beforeUnload = (event: BeforeUnloadEvent) => {
    const draft = composer.draft();
    if (
      !draft ||
      (draft.event && !dismissalState?.dirty() && !dismissalState?.pending())
    ) {
      return;
    }
    event.preventDefault();
    event.returnValue = '';
  };
  window.addEventListener('beforeunload', beforeUnload);
  onCleanup(() => window.removeEventListener('beforeunload', beforeUnload));

  return (
    <Show keyed when={composer.draft()}>
      {(draft) => (
        <Suspense
          fallback={
            <CalendarEditorLoading
              boundary={props.boundary}
              draft={draft}
              onClose={requestClose}
            />
          }
        >
          <CalendarEditorReady
            boundary={props.boundary}
            draft={draft}
            onClose={requestClose}
            registerDismissalState={registerDismissalState}
          />
        </Suspense>
      )}
    </Show>
  );
}

function CalendarEditorReady(props: CalendarEditorProps) {
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

function CalendarEditorLoading(
  props: Pick<CalendarEditorProps, 'boundary' | 'draft' | 'onClose'>
) {
  const composer = useCalendarEditor();
  return (
    <CalendarEditorSurface
      {...props}
      surface={composer.surface()}
      anchor={composer.previewAnchor()}
      onMoveToSidebar={composer.moveToSidebar}
      onMoveToPopover={composer.moveToPopover}
      pending={false}
      onClose={props.onClose}
    >
      <p role="status" class="p-4">
        Loading event…
      </p>
    </CalendarEditorSurface>
  );
}

function CalendarEditorContent(
  props: CalendarEditorProps & { macroCallsEnabled: Accessor<boolean> }
) {
  const composer = useCalendarEditor();
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
  onCleanup(
    composer.registerPreview(() => {
      if (props.draft.event) return;
      const time = controller.eventTime();
      if (!time) return;
      return {
        title: controller.state().title,
        color: controller.selectedCalendarOption()?.color,
        time,
      };
    })
  );
  onCleanup(
    props.registerDismissalState({
      dirty: controller.isDirty,
      pending: editor.pending,
    })
  );
  onCleanup(() => {
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  });

  return (
    <CalendarEditorSurface
      boundary={props.boundary}
      draft={props.draft}
      pending={editor.pending()}
      onClose={props.onClose}
      surface={composer.surface()}
      anchor={composer.previewAnchor()}
      onMoveToSidebar={composer.moveToSidebar}
      onMoveToPopover={composer.moveToPopover}
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
        onCancel={props.onClose}
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
