import { useMacroMentionLinkResolver } from '@components/app/split-layout/split-router/mention-links';
import { MarkdownTextarea } from '@core/component/LexicalMarkdown/component/core/MarkdownTextarea';
import { isMobile } from '@core/mobile/isMobile';
import BellSimpleIcon from '@phosphor/bell-simple.svg';
import CalendarBlankIcon from '@phosphor/calendar-blank.svg';
import CalendarDotsIcon from '@phosphor/calendar-dots.svg';
import CalendarXIcon from '@phosphor/calendar-x.svg';
import ChatTextIcon from '@phosphor/chat-text.svg';
import MapPinIcon from '@phosphor/map-pin.svg';
import RepeatIcon from '@phosphor/repeat.svg';
import SpinnerIcon from '@phosphor/spinner.svg';
import TextAlignLeftIcon from '@phosphor/text-align-left.svg';
import UsersIcon from '@phosphor/users.svg';
import VideoCameraIcon from '@phosphor/video-camera.svg';
import type { CalendarUpdateScope } from '@service-email/client';
import { Button, cn, Input, RadioGroup } from '@ui';
import {
  createEffect,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  Show,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  calendarDescriptionToEditorHtml,
  exportCalendarDescription,
  sanitizeCalendarDescription,
} from '../../utils/calendar-description';
import {
  formatReminderOffset,
  REMINDER_METHOD_POPUP,
  resolveReminderOverrides,
} from '../../utils/event-reminders';
import type { CalendarEventFormController } from './create-calendar-event-form-controller';
import { EventDateTimeRangeFields } from './EventDateTimeRangeFields';
import {
  EventComposerCalendarPill,
  EventComposerConferencePill,
  EventComposerDeclineMessagePill,
  EventComposerDeclinePill,
  EventComposerGuestsPill,
  EventComposerKindPill,
  EventComposerRecurrencePill,
  EventComposerRemindersPill,
} from './EventPropertyPills';
import { EventRecurrenceDialog } from './EventRecurrenceDialog';
import type {
  EventEditorDisabledFields,
  EventEditorSubmitValues,
} from './event-form-model';
import { outOfOfficeNoticeFor } from './out-of-office';

export interface EventFormProps {
  controller: CalendarEventFormController;
  /** Whether this host can create and attach Macro call links. */
  macroCallsEnabled: boolean;
  isEdit?: boolean;
  disabledFields?: EventEditorDisabledFields;
  showRecurringEditNotice?: boolean;
  /** Disable interaction without presenting the form as an in-flight save. */
  disabled?: boolean;
  pending: boolean;
  saveError?: string;
  class?: string;
  onCalendarChange?: (calendarId: string, color: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onCancel: () => void;
  onSubmit: (
    values: EventEditorSubmitValues,
    scope?: CalendarUpdateScope
  ) => void;
}

/** Whether edits to a recurring event patch one occurrence or the whole series. */
const RECURRING_EDIT_SCOPE_OPTIONS = [
  { scope: 'this_event', label: 'This event' },
  { scope: 'all', label: 'All events' },
] as const satisfies readonly {
  scope: CalendarUpdateScope;
  label: string;
}[];

/** Shared event controls for creation and editing. */
export function EventForm(props: EventFormProps) {
  const formId = createUniqueId();
  const resolveAppLink = useMacroMentionLinkResolver();

  const dateRangeErrorId = `event-composer-date-range-error-${formId}`;
  const pastEventWarningId = `event-composer-past-event-warning-${formId}`;

  const controller = props.controller;
  const state = controller.state;
  const isEdit = () => props.isEdit ?? false;
  const formIsDisabled = () => props.pending || props.disabled === true;

  // Recurring edits default to the whole series, matching the long-standing
  // behavior; "this event" writes a single-occurrence exception.
  const editScope = controller.editScope;
  const setEditScope = controller.setEditScope;
  const [recurrenceDialogOpen, setRecurrenceDialogOpen] = createSignal(false);

  // An invalid range already speaks for itself; only one line shows at a time.
  const pastEventWarning = () =>
    controller.dateRangeError() ? undefined : controller.pastEventWarning();
  const dateRangeDescribedBy = () => {
    if (controller.dateRangeError()) return dateRangeErrorId;
    return pastEventWarning() ? pastEventWarningId : undefined;
  };

  const fieldIsReadOnly = (field: keyof EventEditorDisabledFields) =>
    props.disabledFields?.[field] === true;
  const fieldIsDisabled = (field: keyof EventEditorDisabledFields) =>
    formIsDisabled() || fieldIsReadOnly(field);

  const isOutOfOffice = () => controller.isOutOfOffice();
  // The decline settings of an edited event are unknown until picked, and the
  // disclosure must not claim behavior nobody chose.
  const outOfOfficeNotice = () => {
    const outOfOffice = state().outOfOffice;
    if (!isOutOfOffice() || !outOfOffice) return undefined;
    return outOfOfficeNoticeFor(
      outOfOffice.autoDeclineMode,
      outOfOffice.declineMessage
    );
  };

  // The editor cannot hand the provider's string back: Lexical re-serializes
  // whatever it loads. Only content that exports differently from what was
  // loaded counts as an edit, so an untouched description stays byte-for-byte
  // what the event was opened with.
  const initialDescription = state().description;
  let loadedDescription: string | undefined;

  createEffect(() => {
    const option = controller.selectedCalendarOption();
    if (option) props.onCalendarChange?.(option.id, option.color);
  });
  createEffect(() => props.onDirtyChange?.(controller.isDirty()));

  const submit = () => {
    const values = controller.submitValues();
    if (!values || formIsDisabled()) return;
    props.onSubmit(
      values,
      props.showRecurringEditNotice ? editScope() : undefined
    );
  };

  const titleField = () => (
    <Show
      when={fieldIsReadOnly('title')}
      fallback={
        <Input
          type="text"
          value={state().title}
          onInput={(event) =>
            controller.setField('title', event.currentTarget.value)
          }
          placeholder="New event"
          aria-label="Title"
          autofocus={!isEdit() && !isMobile()}
          disabled={fieldIsDisabled('title')}
          class="h-9 w-full border-transparent rounded-none shadow-none bg-transparent px-2 text-lg font-semibold leading-snug text-ink outline-none placeholder:text-ink-placeholder sm:text-base"
        />
      }
    >
      <span
        aria-label="Title"
        class="select-text text-lg font-semibold leading-snug text-ink sm:text-base"
      >
        {state().title}
      </span>
    </Show>
  );
  const dateFields = () => (
    <div class="flex w-full min-w-0 flex-col gap-1">
      <EventDateTimeRangeFields
        start={state().start}
        end={state().end}
        allDay={state().allDay}
        onRangeChange={controller.setDateRange}
        onAllDayChange={controller.setAllDay}
        startDisabled={fieldIsDisabled('start')}
        endDisabled={fieldIsDisabled('end')}
        allDayDisabled={fieldIsDisabled('allDay')}
        startReadOnly={fieldIsReadOnly('start')}
        endReadOnly={fieldIsReadOnly('end')}
        allDayReadOnly={fieldIsReadOnly('allDay')}
        invalid={controller.dateRangeError() !== undefined}
        describedBy={dateRangeDescribedBy()}
      />
      <Show when={controller.dateRangeError()}>
        {(error) => (
          <p id={dateRangeErrorId} role="alert" class="text-xs text-failure">
            {error()}
          </p>
        )}
      </Show>
      <Show when={pastEventWarning()}>
        {(warning) => (
          <p id={pastEventWarningId} role="status" class="text-xs text-warning">
            {warning()}
          </p>
        )}
      </Show>
    </div>
  );
  const descriptionField = () => (
    <Show
      when={fieldIsReadOnly('description')}
      fallback={
        <div class="min-h-9 min-w-0 w-full max-h-36 overflow-y-auto rounded-xl border border-edge-muted bg-control px-2 py-2 touch:min-h-[44px] touch:py-3">
          <MarkdownTextarea
            resolveAppLink={resolveAppLink}
            type="calendar"
            initialHtml={calendarDescriptionToEditorHtml(initialDescription)}
            editable={() => !fieldIsDisabled('description')}
            onInitialized={(editor) => {
              loadedDescription = exportCalendarDescription(editor);
            }}
            onChange={(_markdown, editor) => {
              if (!editor) return;
              const next = exportCalendarDescription(editor);
              controller.setField(
                'description',
                next === loadedDescription ? initialDescription : next
              );
            }}
            placeholder="Add description..."
            portalScope="local"
            domRef={(element) =>
              element.setAttribute('aria-label', 'Description')
            }
            class="h-auto min-h-0 w-full bg-transparent px-0 text-xs leading-normal text-ink outline-none [&>.md>:first-child]:mt-0 [&>.md>:last-child]:mb-0 [&>.pointer-events-none>p]:my-0"
          />
        </div>
      }
    >
      <div
        class="min-w-0 select-text break-words leading-relaxed [&_a]:text-accent [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-4 [&_p+p]:mt-1 [&_ul]:list-disc [&_ul]:pl-4"
        innerHTML={
          sanitizeCalendarDescription(state().description) || 'No description'
        }
      />
    </Show>
  );
  const controls = {
    kind: () => (
      <EventComposerKindPill
        eventType={state().eventType}
        onChange={controller.setEventKind}
        disabled={formIsDisabled()}
        readOnly={isEdit()}
      />
    ),
    calendar: () => (
      <EventComposerCalendarPill
        options={controller.calendarOptions()}
        value={controller.selectedCalendarOption()}
        onChange={(calendarId) => controller.setField('calendarId', calendarId)}
        disabled={formIsDisabled()}
        readOnly={fieldIsReadOnly('calendar')}
        hideIcon
      />
    ),
    recurrence: () => (
      <EventComposerRecurrencePill
        options={controller.recurrenceOptions()}
        value={controller.selectedRecurrenceOption()}
        onChange={(choice) =>
          choice === 'custom'
            ? setRecurrenceDialogOpen(true)
            : controller.changeRecurrenceChoice(choice)
        }
        onEditCustom={() => setRecurrenceDialogOpen(true)}
        disabled={formIsDisabled()}
        // A single occurrence has no recurrence rule of its own.
        readOnly={fieldIsReadOnly('recurrence') || editScope() === 'this_event'}
        hideIcon
      />
    ),
    guests: () => (
      <EventComposerGuestsPill
        options={controller.guestOptions}
        selected={controller.selectedGuests()}
        onChange={controller.setSelectedGuests}
        disabled={formIsDisabled()}
        readOnly={fieldIsReadOnly('guests')}
        hideIcon
      />
    ),
    conference: () => (
      <EventComposerConferencePill
        value={state().conference}
        macroCallsEnabled={props.macroCallsEnabled}
        canKeepExisting={controller.initialConferenceChoice() === 'existing'}
        onChange={(conference) => controller.setField('conference', conference)}
        disabled={formIsDisabled()}
        readOnly={fieldIsReadOnly('conference')}
        hideIcon
      />
    ),
    location: () => (
      <Show
        when={fieldIsReadOnly('location')}
        fallback={
          <Input
            type="text"
            value={state().location}
            onInput={(event) =>
              controller.setField('location', event.currentTarget.value)
            }
            placeholder="Add location..."
            aria-label="Location"
            disabled={fieldIsDisabled('location')}
            class="h-9 min-w-0 w-full rounded-xl border-edge-muted bg-control px-2 py-2 text-sm leading-tight text-ink shadow-none placeholder:text-ink-placeholder focus-visible:bg-active focus-visible:outline-none focus-visible:ring-0 sm:text-xs touch:min-h-[44px]"
          />
        }
      >
        <span class="select-text break-words">
          {state().location || 'No location'}
        </span>
      </Show>
    ),
    decline: () => (
      <EventComposerDeclinePill
        value={state().outOfOffice}
        onChange={controller.setOutOfOffice}
        disabled={formIsDisabled()}
        hideIcon
      />
    ),
    declineMessage: () => (
      <Show
        when={
          state().outOfOffice &&
          state().outOfOffice?.autoDeclineMode !== 'decline_none'
        }
      >
        <EventComposerDeclineMessagePill
          value={state().outOfOffice?.declineMessage ?? ''}
          onChange={(declineMessage) =>
            controller.setOutOfOffice({
              autoDeclineMode:
                state().outOfOffice?.autoDeclineMode ?? 'decline_none',
              declineMessage,
            })
          }
          disabled={formIsDisabled()}
          hideIcon
        />
      </Show>
    ),
    reminders: () => (
      <Show
        when={fieldIsReadOnly('reminders')}
        fallback={
          <EventComposerRemindersPill
            minutes={controller.reminderMinutes()}
            usedSlots={
              controller.reminderMinutes().length +
              controller.preservedReminderCount()
            }
            canAdd={controller.canAddReminder()}
            onChange={controller.setReminderMinutes}
            disabled={fieldIsDisabled('reminders')}
            hideIcon
          />
        }
      >
        <div class="flex select-text flex-col gap-0.5">
          <For
            each={resolveReminderOverrides(
              state().reminders,
              controller.selectedCalendarOption()?.defaultReminders,
              state().reminderEventType ?? state().eventType
            )}
            fallback={<span>No notifications</span>}
          >
            {(reminder) => (
              <span>
                {formatReminderOffset(reminder.minutes)}
                {reminder.method === REMINDER_METHOD_POPUP ? '' : ' (email)'}
              </span>
            )}
          </For>
        </div>
      </Show>
    ),
  };
  const PropertyRow = (row: {
    label: string;
    icon: typeof CalendarBlankIcon;
    children: JSX.Element;
  }) => (
    <div
      role="group"
      aria-label={row.label}
      class="group/field grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-2 sm:grid-cols-[1rem_minmax(0,1fr)]"
    >
      <div class="flex h-7 items-center justify-center group-has-[button[aria-expanded],input,[role=textbox]]/field:h-9 touch:group-has-[button[aria-expanded],input,[role=textbox]]/field:min-h-[44px]">
        <Dynamic
          component={row.icon}
          aria-hidden="true"
          class="size-5 text-ink-extra-muted sm:size-4"
        />
      </div>
      <div class="flex min-h-7 min-w-0 w-full flex-wrap items-center gap-2">
        {row.children}
      </div>
    </div>
  );

  return (
    <form
      class={cn(
        'flex min-h-0 flex-1 flex-col gap-4 text-sm text-ink-muted [&_:disabled]:cursor-not-allowed',
        props.class
      )}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div class="min-h-0 flex-1 overflow-y-auto scrollbar-hidden">
        <div class="flex min-w-0 flex-col gap-3 p-1 text-sm text-ink-muted sm:gap-2 sm:text-xs">
          <div class="grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 sm:grid-cols-[1rem_minmax(0,1fr)]">
            <span aria-hidden="true" class="flex items-center justify-center">
              <Show when={controller.selectedCalendarOption()}>
                {(calendar) => (
                  <span
                    class="size-4 rounded-sm sm:size-3"
                    style={{ 'background-color': calendar().color }}
                  />
                )}
              </Show>
            </span>
            {titleField()}
            <div class="col-start-2 min-w-0 px-2 pb-1">{controls.kind()}</div>
          </div>
          <Show when={!isOutOfOffice()}>
            <PropertyRow label="Description" icon={TextAlignLeftIcon}>
              {descriptionField()}
            </PropertyRow>
          </Show>
          <PropertyRow label="Date and time" icon={CalendarBlankIcon}>
            {dateFields()}
          </PropertyRow>
          <PropertyRow label="Repeats" icon={RepeatIcon}>
            {controls.recurrence()}
          </PropertyRow>
          <Show when={!isOutOfOffice()}>
            <PropertyRow label="Meeting link" icon={VideoCameraIcon}>
              {controls.conference()}
            </PropertyRow>
            <PropertyRow label="Location" icon={MapPinIcon}>
              {controls.location()}
            </PropertyRow>
          </Show>
          <Show when={isOutOfOffice()}>
            <PropertyRow label="Decline" icon={CalendarXIcon}>
              {controls.decline()}
            </PropertyRow>
            <Show
              when={
                state().outOfOffice &&
                state().outOfOffice?.autoDeclineMode !== 'decline_none'
              }
            >
              <PropertyRow label="Reply" icon={ChatTextIcon}>
                {controls.declineMessage()}
              </PropertyRow>
            </Show>
          </Show>
          <PropertyRow label="Notifications" icon={BellSimpleIcon}>
            {controls.reminders()}
          </PropertyRow>
          <PropertyRow label="Calendar" icon={CalendarDotsIcon}>
            {controls.calendar()}
          </PropertyRow>
          <Show when={!isOutOfOffice()}>
            <PropertyRow label="Guests" icon={UsersIcon}>
              {controls.guests()}
            </PropertyRow>
          </Show>
          <Show when={outOfOfficeNotice()}>
            {(notice) => (
              <div
                role="note"
                aria-label="Out-of-office event"
                class="flex min-w-0 flex-col gap-1 rounded-lg border border-warning/40 bg-warning-bg p-3 text-xs text-warning-ink"
              >
                <span class="font-medium">Out-of-office event</span>
                <span>{notice().effect}</span>
                <Show when={notice().declineMessage}>
                  {(message) => (
                    <span class="italic">
                      Auto-decline reply: “{message()}”
                    </span>
                  )}
                </Show>
              </div>
            )}
          </Show>
        </div>
      </div>
      <EventRecurrenceDialog
        open={recurrenceDialogOpen()}
        onClose={() => setRecurrenceDialogOpen(false)}
        choice={controller.recurrenceChoice()}
        config={controller.customConfig()}
        start={controller.startForRecurrence()}
        allDay={state().allDay}
        onDone={(config) => {
          controller.changeRecurrenceChoice('custom');
          controller.setCustomConfig(config);
          setRecurrenceDialogOpen(false);
        }}
      />

      <Show when={props.saveError}>
        <p role="alert" class="text-sm text-failure">
          {props.saveError}
        </p>
      </Show>
      <Show
        when={props.showRecurringEditNotice && controller.hasRecurrenceEdits()}
      >
        <p role="status" class="text-xs text-ink-muted">
          Repeat changes apply to all events.
        </p>
      </Show>
      <div class="flex shrink-0 items-center justify-end gap-3">
        <Show when={props.showRecurringEditNotice}>
          <RadioGroup
            value={editScope()}
            onChange={(value) => setEditScope(value as CalendarUpdateScope)}
            disabled={formIsDisabled()}
            aria-label="Apply changes to"
            class="mr-auto flex-row items-center gap-3 text-xs text-ink-muted"
          >
            <For each={RECURRING_EDIT_SCOPE_OPTIONS}>
              {(option) => (
                <RadioGroup.Item
                  value={option.scope}
                  disabled={
                    option.scope === 'this_event' &&
                    controller.hasRecurrenceEdits()
                  }
                  class="gap-1.5"
                >
                  <RadioGroup.ItemControl class="size-3.5" />
                  <RadioGroup.ItemLabel>{option.label}</RadioGroup.ItemLabel>
                </RadioGroup.Item>
              )}
            </For>
          </RadioGroup>
        </Show>
        <Button
          type="button"
          variant="ghost"
          disabled={formIsDisabled()}
          onClick={props.onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="cta"
          depth={3}
          disabled={!controller.canSave() || formIsDisabled()}
          aria-label={isEdit() ? 'Save' : 'Create event'}
          aria-busy={props.pending}
        >
          <span class={cn(props.pending && 'invisible')}>
            {isEdit() ? 'Save' : 'Create event'}
          </span>
          <Show when={props.pending}>
            <SpinnerIcon
              aria-hidden="true"
              class="absolute inset-0 m-auto size-4 animate-spin"
            />
          </Show>
        </Button>
      </div>
    </form>
  );
}
