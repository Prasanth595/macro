import { Popover } from '@kobalte/core/popover';
import Info from '@phosphor/info.svg';
import Plus from '@phosphor/plus.svg';
import Trash from '@phosphor/trash.svg';
import { Button, ToggleSwitch } from '@ui';
import {
  type ComponentProps,
  createEffect,
  createSignal,
  createUniqueId,
  For,
  Index,
  type JSX,
  on,
  Show,
} from 'solid-js';
import { MINUTE_UNITS } from '../core/booking-units';
import type { EventDetail } from '../core/event-editor';
import type { BookingQuestion, EventValidationIssue } from '../core/types';
import { BookingRules } from './booking-rules';
import { BookingValueInput } from './booking-value-input';
import type { EventEditorProps } from './event-editor';
import {
  CheckField,
  FieldError,
  SelectInput,
  TextArea,
  TextInput,
} from './fields';
import { WeeklyHoursSummary } from './weekly-hours-summary';

type SinglePageEventEditorProps = Omit<
  EventEditorProps,
  'step' | 'onNext' | 'onBack'
>;

const DURATION_MINUTES = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480];

function durationLabel(minutes: number) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return `${minutes} minutes`;
}

const DURATION_OPTIONS = [
  ...DURATION_MINUTES.map((minutes) => ({
    value: String(minutes),
    label: durationLabel(minutes),
  })),
  { value: 'custom', label: 'Custom duration' },
];

function EditorSelect(
  props: Omit<ComponentProps<typeof SelectInput>, 'class' | 'contentClass'>
) {
  return (
    <SelectInput
      {...props}
      class="h-9 w-full rounded-lg px-3 text-sm"
      contentClass="[&_[role=option]]:min-h-9 [&_[role=option]]:px-3 [&_[role=option]]:py-2 [&_[role=option]]:font-medium"
    />
  );
}

/** Shared rhythm for every field and optional setting in the single-page dialog. */
function EditorSection(props: {
  title: string;
  required?: boolean;
  controlId?: string;
  detail?: EventDetail;
  action?: JSX.Element;
  children: JSX.Element;
}) {
  const headingId = createUniqueId();
  return (
    <section
      aria-labelledby={headingId}
      data-booking-editor-section
      data-optional-setting={props.detail}
      class="flex min-w-0 flex-col gap-1.5 border-t border-edge-muted px-5 py-3 first:border-t-0 sm:px-6"
    >
      <div
        data-booking-section-heading
        class="flex min-h-6 items-center justify-between gap-3 touch:min-h-9"
      >
        <h3 id={headingId} class="text-sm font-normal text-ink-muted">
          <Show when={props.controlId} fallback={props.title}>
            {(id) => <label for={id()}>{props.title}</label>}
          </Show>
          <Show when={props.required}>
            <span aria-hidden="true" class="ml-0.5 text-failure">
              *
            </span>
          </Show>
        </h3>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}

function OptionalSetting(props: {
  title: string;
  detail: EventDetail;
  expanded: boolean;
  required?: boolean;
  disabled: boolean;
  removeLabel?: string;
  preview?: JSX.Element;
  onAdd: () => void;
  onRemove: () => void;
  children: JSX.Element;
}) {
  return (
    <EditorSection
      title={props.title}
      detail={props.detail}
      required={props.required}
      action={
        <Show when={props.expanded}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            label={props.removeLabel ?? `Remove ${props.title.toLowerCase()}`}
            disabled={props.disabled}
            onClick={props.onRemove}
          >
            <Trash class="size-3.5" aria-hidden="true" />
          </Button>
        </Show>
      }
    >
      <Show
        when={props.expanded}
        fallback={
          <Button
            type="button"
            data-booking-add-detail
            size="md"
            variant="outline"
            class="self-start rounded-lg"
            disabled={props.disabled}
            onClick={props.onAdd}
          >
            <Plus class="size-3.5" aria-hidden="true" />
            Add {props.title.toLowerCase()}
          </Button>
        }
      >
        {props.children}
      </Show>
      {props.preview}
    </EditorSection>
  );
}

function QuestionField(props: {
  question: BookingQuestion;
  index: number;
  disabled: boolean;
  error?: string;
  onUpdate: (
    changes: Partial<Pick<BookingQuestion, 'label' | 'required'>>
  ) => void;
  onRemove: () => void;
}) {
  const inputId = createUniqueId();
  const errorId = createUniqueId();
  return (
    <div data-booking-question-row class="flex flex-col gap-1.5">
      <div class="flex min-h-6 flex-wrap items-center justify-between gap-2 touch:min-h-9">
        <label for={inputId} class="text-sm font-normal text-ink-muted">
          Question {props.index + 1}
          <span aria-hidden="true" class="ml-0.5 text-failure">
            *
          </span>
        </label>
        <div class="flex items-center gap-3">
          <CheckField
            checked={props.question.required}
            label="Required"
            disabled={props.disabled}
            controlClass="bg-transparent"
            onChange={(required) => props.onUpdate({ required })}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            label={`Remove question ${props.index + 1}`}
            disabled={props.disabled}
            onClick={props.onRemove}
          >
            <Trash class="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <TextInput
        size="lg"
        class="text-base sm:text-sm"
        id={inputId}
        data-booking-question-input
        required
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? errorId : undefined}
        value={props.question.label}
        placeholder="What would you like to discuss?"
        disabled={props.disabled}
        onInput={(event) =>
          props.onUpdate({ label: event.currentTarget.value })
        }
      />
      <FieldError id={errorId} message={props.error} />
    </div>
  );
}

/** A comparison variant that keeps the core booking fields visible on one page. */
export function SinglePageEventEditor(props: SinglePageEventEditorProps) {
  const titleId = createUniqueId();
  const descriptionId = createUniqueId();
  const titleErrorId = createUniqueId();
  const slugErrorId = createUniqueId();
  const scheduleErrorId = createUniqueId();
  const hostsErrorId = createUniqueId();
  const submitErrorId = createUniqueId();
  const [copying, setCopying] = createSignal(false);
  const [copyError, setCopyError] = createSignal('');
  let formElement: HTMLFormElement | undefined;
  let scrollArea: HTMLDivElement | undefined;
  let questionList: HTMLDivElement | undefined;
  let addQuestionTrigger: HTMLButtonElement | undefined;
  let durationInput: HTMLInputElement | undefined;
  const [scheduleInfoTrigger, setScheduleInfoTrigger] =
    createSignal<HTMLButtonElement>();
  const [customDuration, setCustomDuration] = createSignal(
    !DURATION_MINUTES.includes(props.draft.durationMinutes)
  );
  const error = (field: EventValidationIssue['field']) =>
    props.issues.find((issue) => issue.field === field)?.message;
  const questionError = (question: BookingQuestion) =>
    props.issues.find(
      (issue) => issue.field === 'questions' && issue.questionId === question.id
    )?.message;
  const schedule = () =>
    props.schedules.find((item) => item.id === props.draft.scheduleId);
  const durationSelection = () =>
    customDuration() ? 'custom' : String(props.draft.durationMinutes);
  const missingHosts = () =>
    props.draft.hosts.filter(
      (id) => !props.members.some((member) => member.id === id)
    );
  const primaryError = () =>
    props.submitError || (!props.team ? error('hosts') : undefined);
  const primaryLabel = () =>
    props.submitLabel ?? (props.isNew ? 'Create link' : 'Save changes');
  const addDetail = (detail: EventDetail) => {
    props.onAddDetail(detail);
    queueMicrotask(() => {
      const selector =
        detail === 'link'
          ? '[data-optional-setting="link"] input'
          : detail === 'questions'
            ? '[data-optional-setting="questions"] input[data-booking-question-input]'
            : detail === 'hosts'
              ? '[data-optional-setting="hosts"] input'
              : '[data-optional-setting="rules"] input';
      const target = formElement?.querySelector<HTMLElement>(selector);
      if (target && !target.matches(':disabled')) {
        target.scrollIntoView?.({ block: 'nearest' });
        target.focus({ preventScroll: true });
      }
    });
  };
  const removeDetail = (detail: EventDetail) => {
    props.onRemoveDetail(detail);
    queueMicrotask(() => {
      formElement
        ?.querySelector<HTMLButtonElement>(
          `[data-optional-setting="${detail}"] [data-booking-add-detail]`
        )
        ?.focus({ preventScroll: true });
    });
  };
  const removeQuestion = (id: string) => {
    const questions = props.draft.questions;
    const index = questions.findIndex((question) => question.id === id);
    if (index < 0) return;
    props.onUpdate(
      'questions',
      questions.filter((question) => question.id !== id)
    );
    queueMicrotask(() => {
      const inputs = questionList?.querySelectorAll<HTMLInputElement>(
        '[data-booking-question-input]'
      );
      const target = inputs?.length
        ? inputs[Math.min(index, inputs.length - 1)]
        : addQuestionTrigger;
      target?.focus({ preventScroll: true });
    });
  };
  const addQuestion = () => {
    props.onUpdate('questions', [
      ...props.draft.questions,
      { id: crypto.randomUUID(), label: '', required: false },
    ]);
    queueMicrotask(() => {
      const inputs = questionList?.querySelectorAll<HTMLInputElement>(
        '[data-booking-question-input]'
      );
      inputs?.[inputs.length - 1]?.focus({ preventScroll: true });
    });
  };
  const copyLink = async () => {
    if (!props.onCopyLink || copying() || props.saving) return;
    setCopyError('');
    setCopying(true);
    try {
      await props.onCopyLink();
    } catch {
      setCopyError('Could not copy booking link. Try again.');
    } finally {
      setCopying(false);
    }
  };

  createEffect(
    on(
      () => props.validationAttempt,
      (attempt, previous) => {
        if (previous === undefined || attempt === previous) return;
        queueMicrotask(() => {
          if (props.validationAttempt !== attempt) return;
          const invalid = formElement?.querySelector<HTMLElement>(
            'input[aria-invalid="true"], button[aria-invalid="true"], [tabindex][aria-invalid="true"]'
          );
          if (!invalid || invalid.matches(':disabled')) return;
          invalid.focus({ preventScroll: true });
          invalid.scrollIntoView?.({ block: 'nearest' });
          if (scrollArea) {
            const area = scrollArea.getBoundingClientRect();
            const target = invalid.getBoundingClientRect();
            if (target.top < area.top || target.bottom > area.bottom)
              scrollArea.scrollTop += target.top - area.top;
          }
        });
      }
    )
  );

  return (
    <form
      ref={formElement}
      data-booking-editor-variant="single-page"
      class="flex h-[min(56rem,calc(100dvh-var(--virtual-keyboard-height,0px)-var(--safe-top,0px)-var(--safe-bottom,0px)-2rem))] min-h-0 flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!props.saving) void props.onSave();
      }}
    >
      <header class="flex shrink-0 items-start justify-between gap-4 border-b border-edge-muted px-5 pt-5 pb-4 sm:px-6">
        <div class="min-w-0">
          <h2 class="text-xl font-medium tracking-wide">
            {props.isNew ? 'New booking link' : 'Edit booking link'}
          </h2>
        </div>
        <Show when={props.onCopyLink && !props.isNew}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={props.saving || copying()}
            onClick={() => void copyLink()}
          >
            {copying() ? 'Copying…' : 'Copy link'}
          </Button>
        </Show>
      </header>
      <div
        ref={scrollArea}
        data-booking-single-page-scroll-area
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div class="flex flex-col gap-0">
          <EditorSection title="Title" required controlId={titleId}>
            <TextInput
              id={titleId}
              required
              size="lg"
              class="text-base sm:text-sm"
              placeholder="30 minute meeting"
              value={props.draft.title}
              disabled={props.saving}
              aria-invalid={error('title') ? true : undefined}
              aria-describedby={error('title') ? titleErrorId : undefined}
              onInput={(event) => props.onTitle(event.currentTarget.value)}
            />
            <FieldError id={titleErrorId} message={error('title')} />
          </EditorSection>
          <OptionalSetting
            title="Custom link"
            detail="link"
            expanded={props.details.includes('link')}
            disabled={props.saving}
            onAdd={() => addDetail('link')}
            onRemove={() => removeDetail('link')}
            preview={
              <output
                aria-label="Booking link preview"
                aria-live="off"
                class="break-all text-xs text-ink-muted"
              >
                {props.link ?? `/${props.draft.slug || 'your-link'}`}
              </output>
            }
          >
            <TextInput
              size="lg"
              class="text-base sm:text-sm"
              aria-label="Custom link"
              value={props.draft.slug}
              disabled={props.saving}
              aria-invalid={error('slug') ? true : undefined}
              aria-describedby={error('slug') ? slugErrorId : undefined}
              onInput={(event) =>
                props.onUpdate('slug', event.currentTarget.value)
              }
            />
            <FieldError id={slugErrorId} message={error('slug')} />
          </OptionalSetting>
          <EditorSection
            title="Description (optional)"
            controlId={descriptionId}
          >
            <TextArea
              id={descriptionId}
              rows={3}
              class="min-h-20 text-base sm:text-sm"
              value={props.draft.description}
              disabled={props.saving}
              placeholder="What should guests know before booking?"
              onInput={(event) =>
                props.onUpdate('description', event.currentTarget.value)
              }
            />
          </EditorSection>
          <EditorSection title="Duration" required>
            <EditorSelect
              label="Duration"
              value={durationSelection()}
              required
              disabled={props.saving}
              error={customDuration() ? undefined : error('durationMinutes')}
              options={DURATION_OPTIONS}
              onChange={(value) => {
                setCustomDuration(value === 'custom');
                if (value !== 'custom')
                  props.onUpdate('durationMinutes', Number(value));
                else
                  queueMicrotask(() =>
                    durationInput?.focus({ preventScroll: true })
                  );
              }}
            />
            <Show when={customDuration()}>
              <BookingValueInput
                label="Duration"
                inputRef={(element) => {
                  durationInput = element;
                }}
                value={props.draft.durationMinutes}
                min={5}
                max={480}
                units={MINUTE_UNITS}
                compact
                fullWidth
                controls={false}
                disabled={props.saving}
                error={error('durationMinutes')}
                onChange={(value) => props.onUpdate('durationMinutes', value)}
              />
            </Show>
          </EditorSection>

          <EditorSection title="Availability" required>
            <div class="grid grid-cols-[minmax(0,1fr)_2.25rem] items-start gap-2">
              <Show
                when={props.availability}
                fallback={
                  <EditorSelect
                    label="Availability schedule"
                    value={props.draft.scheduleId}
                    disabled={props.saving}
                    required
                    error={error('scheduleId')}
                    options={props.schedules.map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                    onChange={(value) => props.onUpdate('scheduleId', value)}
                  />
                }
              >
                <div
                  role="group"
                  aria-label="Availability schedule"
                  tabindex="-1"
                  aria-invalid={error('scheduleId') ? true : undefined}
                  aria-describedby={
                    error('scheduleId') ? scheduleErrorId : undefined
                  }
                  class="min-w-0 rounded-lg outline-none aria-invalid:ring-2 aria-invalid:ring-failure/30"
                >
                  {props.availability}
                  <FieldError
                    id={scheduleErrorId}
                    message={error('scheduleId')}
                  />
                </div>
              </Show>
              <Popover placement="bottom-end" gutter={6} modal={false}>
                <Popover.Trigger
                  as={Button}
                  ref={setScheduleInfoTrigger}
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  class="size-9"
                  aria-label="View schedule hours"
                  disabled={!schedule() || props.saving}
                >
                  <Info class="size-4" aria-hidden="true" />
                </Popover.Trigger>
                <Popover.Portal
                  mount={
                    scheduleInfoTrigger()?.closest<HTMLElement>(
                      '.portal-scope'
                    ) ?? undefined
                  }
                >
                  <Popover.Content class="menu-surface z-action-menu w-80 max-w-[calc(100vw-2rem)] p-4 outline-none">
                    <Popover.Title class="text-sm font-medium">
                      {schedule()?.name ?? 'Availability schedule'}
                    </Popover.Title>
                    <Show when={schedule()}>
                      {(item) => <WeeklyHoursSummary schedule={item()} />}
                    </Show>
                  </Popover.Content>
                </Popover.Portal>
              </Popover>
            </div>
          </EditorSection>

          <EditorSection title="Meeting link">
            <EditorSelect
              label="Meeting link type"
              value={props.draft.googleMeet ? 'google-meet' : 'custom'}
              disabled={props.saving}
              options={[
                { value: 'google-meet', label: 'Google Meet' },
                { value: 'custom', label: 'Custom' },
              ]}
              onChange={(value) =>
                props.onUpdate('googleMeet', value === 'google-meet')
              }
            />
            <Show
              when={!props.draft.googleMeet}
              fallback={
                <TextInput
                  size="lg"
                  class="text-base sm:text-sm"
                  aria-label="Joining instructions"
                  value={props.draft.location}
                  disabled={props.saving}
                  placeholder="Extra directions or a backup meeting link"
                  onInput={(event) =>
                    props.onUpdate('location', event.currentTarget.value)
                  }
                />
              }
            >
              <TextInput
                size="lg"
                class="text-base sm:text-sm"
                aria-label="Location or meeting URL"
                value={props.draft.location}
                disabled={props.saving}
                placeholder="Address, phone number, or meeting URL"
                onInput={(event) =>
                  props.onUpdate('location', event.currentTarget.value)
                }
              />
            </Show>
          </EditorSection>

          <Show when={props.team}>
            <OptionalSetting
              title="Team hosts"
              detail="hosts"
              expanded={
                props.details.includes('hosts') || missingHosts().length > 0
              }
              required
              disabled={props.saving}
              removeLabel="Reset team hosts"
              onAdd={() => addDetail('hosts')}
              onRemove={() => removeDetail('hosts')}
            >
              <EditorSelect
                label="Scheduling type"
                value={props.draft.mode}
                disabled={props.saving}
                options={[
                  {
                    value: 'collective',
                    label: 'Collective · all hosts attend',
                  },
                  {
                    value: 'roundRobin',
                    label: 'Round robin · one available host',
                  },
                ]}
                onChange={(value) =>
                  props.onUpdate(
                    'mode',
                    value === 'roundRobin' ? 'roundRobin' : 'collective'
                  )
                }
              />
              <div
                role="group"
                aria-label="Team hosts"
                tabindex="-1"
                aria-invalid={error('hosts') ? true : undefined}
                aria-describedby={error('hosts') ? hostsErrorId : undefined}
                class="flex flex-col gap-3 rounded-lg outline-none aria-invalid:ring-2 aria-invalid:ring-failure/30"
              >
                <For each={props.members}>
                  {(member) => (
                    <CheckField
                      checked={props.draft.hosts.includes(member.id)}
                      label={member.name || member.email}
                      disabled={props.saving}
                      onChange={(checked) =>
                        props.onUpdate(
                          'hosts',
                          checked
                            ? [...props.draft.hosts, member.id]
                            : props.draft.hosts.filter((id) => id !== member.id)
                        )
                      }
                    />
                  )}
                </For>
                <For each={missingHosts()}>
                  {(id) => (
                    <div class="rounded-lg bg-warning-bg p-3">
                      <CheckField
                        checked
                        label="Former team member"
                        disabled={props.saving}
                        onChange={(checked) =>
                          !checked &&
                          props.onUpdate(
                            'hosts',
                            props.draft.hosts.filter((host) => host !== id)
                          )
                        }
                      />
                      <p class="mt-2 text-xs text-ink-muted">
                        Remove this former team member before saving.
                      </p>
                    </div>
                  )}
                </For>
                <FieldError id={hostsErrorId} message={error('hosts')} />
              </div>
            </OptionalSetting>
          </Show>

          <OptionalSetting
            title="Booking questions"
            detail="questions"
            expanded={props.details.includes('questions')}
            disabled={props.saving}
            onAdd={() => addDetail('questions')}
            onRemove={() => removeDetail('questions')}
          >
            <Show when={props.draft.questions.length > 0}>
              <div ref={questionList} class="flex flex-col gap-5">
                <Index each={props.draft.questions}>
                  {(question, index) => (
                    <QuestionField
                      question={question()}
                      index={index}
                      disabled={props.saving}
                      error={questionError(question())}
                      onUpdate={(changes) =>
                        props.onUpdate(
                          'questions',
                          props.draft.questions.map((item) =>
                            item.id === question().id
                              ? { ...item, ...changes }
                              : item
                          )
                        )
                      }
                      onRemove={() => removeQuestion(question().id)}
                    />
                  )}
                </Index>
              </div>
            </Show>
            <Button
              ref={addQuestionTrigger}
              type="button"
              size="md"
              variant="outline"
              class="self-start rounded-lg"
              disabled={props.saving}
              onClick={addQuestion}
            >
              <Plus class="size-3.5" aria-hidden="true" />
              Add a question
            </Button>
          </OptionalSetting>

          <OptionalSetting
            title="Booking rules"
            detail="rules"
            expanded={props.details.includes('rules')}
            disabled={props.saving}
            onAdd={() => addDetail('rules')}
            onRemove={() => removeDetail('rules')}
          >
            <div class="[&_label]:text-sm [&_label]:font-normal [&_label]:text-ink-muted [&_span.font-medium]:text-sm [&_span.font-medium]:font-normal [&_span.font-medium]:text-ink-muted">
              <BookingRules
                draft={props.draft}
                disabled={props.saving}
                issues={props.issues}
                onUpdate={props.onUpdate}
                onBuffers={props.onBuffers}
                onDailyLimitEnabled={props.onDailyLimitEnabled}
              />
            </div>
          </OptionalSetting>

          <Show when={props.draft.requiresConfirmation}>
            <EditorSection title="Confirmation">
              <div class="rounded-lg bg-warning-bg p-3 text-sm">
                <p>
                  This legacy link is paused until automatic confirmation is
                  enabled.
                </p>
                <Button
                  type="button"
                  disabled={props.saving}
                  variant="ghost"
                  size="sm"
                  class="mt-2"
                  onClick={() => props.onUpdate('requiresConfirmation', false)}
                >
                  Use automatic confirmation
                </Button>
              </div>
            </EditorSection>
          </Show>
        </div>
      </div>
      <footer class="flex shrink-0 justify-end border-t border-edge-muted px-5 py-4 sm:px-6">
        <div class="flex min-w-0 max-w-full flex-col items-end gap-2">
          <div class="flex flex-wrap items-center justify-end gap-2">
            <Show when={!props.isNew}>
              <ToggleSwitch
                size="md"
                label="Accept bookings"
                checked={props.draft.enabled}
                disabled={props.saving}
                onChange={(enabled) => props.onUpdate('enabled', enabled)}
              />
            </Show>
            <div class="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                data-booking-cancel
                disabled={props.saving}
                onClick={props.onCancel}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="cta"
                size="lg"
                disabled={props.saving}
                aria-invalid={primaryError() ? true : undefined}
                aria-describedby={primaryError() ? submitErrorId : undefined}
                class="aria-invalid:ring-2 aria-invalid:ring-failure/40"
              >
                {props.saving ? 'Saving…' : primaryLabel()}
              </Button>
            </div>
          </div>
          <FieldError id={submitErrorId} message={primaryError()} />
          <FieldError id={createUniqueId()} message={copyError()} />
        </div>
      </footer>
    </form>
  );
}
