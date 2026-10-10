import { Button } from '@ui';
import { createSignal, Show } from 'solid-js';
import {
  type AvailabilityChange,
  type AvailabilityIssue,
  dateWeekday,
} from '../core/availability';
import { AvailabilityTypePicker } from './availability-type-picker';
import { CheckField, Field, TextInput } from './fields';

export function AvailabilityRangeEditor(props: {
  change: AvailabilityChange;
  date: string;
  issue?: AvailabilityIssue;
  disabled: boolean;
  onChange: (
    update: (current: AvailabilityChange) => AvailabilityChange
  ) => void;
  onApply: (replaceConflicts?: boolean) => void;
  onClose: () => void;
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
        <AvailabilityTypePicker
          mode={props.change.mode}
          onChange={(mode) =>
            props.onChange((change) => ({
              ...change,
              mode,
              target:
                mode === 'unavailable' && change.target.kind === 'weekly'
                  ? { kind: 'date', date: date() }
                  : change.target,
            }))
          }
        />
        <div class="flex items-end gap-4">
          <Field label="Date" class="flex-1 gap-2 text-xs [&_label]:gap-2">
            <TextInput
              type="date"
              aria-label="Availability date"
              class="h-9 w-full text-xs"
              value={date()}
              disabled={editing()}
              onInput={(event) => {
                const value = event.currentTarget.value;
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
        <Show when={!props.change.allDay}>
          <div class="grid grid-cols-2 gap-4">
            <Field label="Start time" class="gap-2 text-xs [&_label]:gap-2">
              <TextInput
                type="time"
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
            <Field label="End time" class="gap-2 text-xs [&_label]:gap-2">
              <TextInput
                type="time"
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
        </Show>
        <Show when={props.change.mode === 'available'}>
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
        </Show>
        <p class="text-xs leading-relaxed text-ink-muted">
          {props.change.target.kind === 'weekly'
            ? 'These hours repeat every week. Date overrides stay unchanged.'
            : props.change.mode === 'unavailable'
              ? editing()
                ? 'This replaces the selected time-off range. Any newly covered available hours need your approval.'
                : 'Time off removes these hours from this date only. Conflicting available hours need your approval.'
              : editing()
                ? 'Only this range changes. Matching available hours merge automatically.'
                : 'These hours extend existing availability on this date. Matching ranges merge automatically.'}
        </p>
        <Show when={props.issue}>
          {(issue) => (
            <p role="alert" class="text-xs leading-relaxed text-failure">
              {issue().message}
            </p>
          )}
        </Show>
        <div class="flex flex-wrap justify-end gap-2 pt-1">
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
            {conflicting() ? 'Keep existing hours' : 'Cancel'}
          </Button>
          <Button
            variant="cta"
            size="sm"
            class="h-auto min-h-7 max-w-full whitespace-normal py-1.5"
            tooltip={
              conflicting()
                ? 'Replace only the conflicting hours with the selected availability type'
                : 'Apply these hours to the schedule'
            }
            onClick={() => props.onApply(conflicting())}
          >
            {conflicting()
              ? props.change.mode === 'available'
                ? 'Make overlapping hours available'
                : 'Mark overlapping hours unavailable'
              : editing()
                ? 'Update hours'
                : 'Add to schedule'}
          </Button>
        </div>
      </fieldset>
    </section>
  );
}
