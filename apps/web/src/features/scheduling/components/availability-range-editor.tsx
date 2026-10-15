import CalendarBlank from '@phosphor/calendar-blank.svg';
import Clock from '@phosphor/clock.svg';
import Repeat from '@phosphor/repeat.svg';
import Trash from '@phosphor/trash.svg';
import WarningCircle from '@phosphor/warning-circle.svg';
import { Button, DatePicker } from '@ui';
import { createSignal, Show } from 'solid-js';
import {
  AVAILABILITY_STEP_MINUTES,
  type AvailabilityChange,
  type AvailabilityIssue,
  dateWeekday,
} from '../core/availability';
import {
  type AvailabilityTimeFormat,
  availabilityOverlapSummary,
} from '../core/availability-month';
import { AvailabilityFieldRow } from './availability-field-row';
import { AvailabilityTypePicker } from './availability-type-picker';
import { BookingFieldInfo } from './booking-field-info';
import { CheckField, Field, TextInput } from './fields';

export function AvailabilityRangeEditor(props: {
  change: AvailabilityChange;
  date: string;
  timeFormat: AvailabilityTimeFormat;
  issue?: AvailabilityIssue;
  disabled: boolean;
  onChange: (
    update: (current: AvailabilityChange) => AvailabilityChange
  ) => void;
  onApply: (replaceConflicts?: boolean) => void;
  onClose: () => void;
  onClear: () => void;
}) {
  const [weeklyDate, setWeeklyDate] = createSignal(props.date);
  const editing = () =>
    props.change.index !== undefined || props.change.origin !== undefined;
  const conflicting = () => !!props.issue?.overlaps?.length;
  const fixedDate = props.change.target.kind === 'date' && editing();
  const date = () =>
    props.change.target.kind === 'date'
      ? props.change.target.date
      : weeklyDate();
  return (
    <section aria-label="Availability form editor" class="min-w-0">
      <fieldset disabled={props.disabled} class="flex min-w-0 flex-col gap-4">
        <div class="flex items-center justify-between gap-2">
          <AvailabilityTypePicker
            mode={props.change.mode}
            onChange={(mode) =>
              props.onChange((change) => ({ ...change, mode }))
            }
          />
          <BookingFieldInfo
            label="these hours"
            description={
              props.change.target.kind === 'weekly'
                ? 'Repeats weekly. Date overrides stay unchanged.'
                : props.change.mode === 'unavailable'
                  ? 'Time off applies to this date only. Replacing available hours requires approval.'
                  : 'Applies to this date only. Matching hours merge; replacing time off requires approval.'
            }
          />
        </div>
        <AvailabilityFieldRow icon={<CalendarBlank />}>
          <div class="flex items-end gap-4">
            <Field label="Date" class="flex-1" labelClass="text-base leading-6">
              <DatePicker
                aria-label="Availability date"
                class="h-9 w-full text-xs"
                value={date()}
                required
                disabled={props.disabled || editing()}
                onChange={(value) => {
                  setWeeklyDate(value);
                  props.onChange((change) => ({
                    ...change,
                    target:
                      change.target.kind === 'weekly'
                        ? { kind: 'weekly', day: dateWeekday(value) }
                        : { kind: 'date', date: value },
                  }));
                }}
              />
            </Field>
            <div class="flex h-9 shrink-0 items-center">
              <CheckField
                label="All day"
                class="text-xs"
                checked={!!props.change.allDay}
                onChange={(allDay) =>
                  props.onChange((change) => ({ ...change, allDay }))
                }
              />
            </div>
          </div>
        </AvailabilityFieldRow>
        <Show when={!props.change.allDay}>
          <AvailabilityFieldRow icon={<Clock />}>
            <div class="grid grid-cols-2 gap-4">
              <Field label="Start time" labelClass="text-base leading-6">
                <TextInput
                  type="time"
                  step={AVAILABILITY_STEP_MINUTES * 60}
                  aria-label="Availability start time"
                  class="h-9 w-full text-xs"
                  value={props.change.window.start}
                  aria-invalid={!!props.issue}
                  onInput={(event) =>
                    props.onChange((change) => ({
                      ...change,
                      window: {
                        ...change.window,
                        start: event.currentTarget.value,
                      },
                    }))
                  }
                />
              </Field>
              <Field label="End time" labelClass="text-base leading-6">
                <TextInput
                  type="time"
                  step={AVAILABILITY_STEP_MINUTES * 60}
                  aria-label="Availability end time"
                  class="h-9 w-full text-xs"
                  value={props.change.window.end}
                  aria-invalid={!!props.issue}
                  onInput={(event) =>
                    props.onChange((change) => ({
                      ...change,
                      window: {
                        ...change.window,
                        end: event.currentTarget.value,
                      },
                    }))
                  }
                />
              </Field>
            </div>
          </AvailabilityFieldRow>
        </Show>
        <AvailabilityFieldRow icon={<Repeat />}>
          <CheckField
            label="Repeat every week"
            class="text-xs"
            checked={props.change.target.kind === 'weekly'}
            disabled={fixedDate}
            onChange={(checked) =>
              props.onChange((change) => ({
                ...change,
                target: checked
                  ? { kind: 'weekly', day: dateWeekday(date()) }
                  : { kind: 'date', date: date() },
              }))
            }
          />
        </AvailabilityFieldRow>
        <Show when={props.issue}>
          {(issue) => (
            <div
              role="alert"
              class="flex items-start gap-2 rounded-lg bg-failure-bg p-2.5 text-xs text-failure"
            >
              <WarningCircle class="mt-0.5 size-3.5 shrink-0" />
              <div class="min-w-0">
                <p class="leading-relaxed">
                  {conflicting()
                    ? availabilityOverlapSummary(
                        props.change.mode,
                        issue().overlaps ?? [],
                        props.timeFormat
                      )
                    : issue().message}
                </p>
                <Show when={conflicting()}>
                  <p class="mt-1 leading-relaxed">
                    Choose Replace hours to make this selection{' '}
                    {props.change.mode}.
                  </p>
                </Show>
              </div>
            </div>
          )}
        </Show>
        <div class="flex flex-wrap justify-end gap-2 pt-1">
          <div class="mr-auto">
            <Button
              variant="ghost"
              size="sm"
              tooltip="Leave these hours blank and non-bookable, without time off"
              onClick={props.onClear}
            >
              <Trash class="size-4" />
              Clear selected hours
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            tooltip={
              conflicting()
                ? 'Keep the current availability unchanged'
                : 'Cancel editing'
            }
            onClick={props.onClose}
          >
            Cancel
          </Button>
          <Button
            variant="cta"
            size="sm"
            tooltip={
              conflicting()
                ? `Replace overlapping hours with ${props.change.mode} hours`
                : 'Apply these hours to the schedule'
            }
            onClick={() => props.onApply(conflicting())}
          >
            {conflicting()
              ? 'Replace hours'
              : editing()
                ? 'Update hours'
                : 'Add to schedule'}
          </Button>
        </div>
      </fieldset>
    </section>
  );
}
