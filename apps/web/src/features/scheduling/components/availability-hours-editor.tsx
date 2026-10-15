import Clock from '@phosphor/clock.svg';
import Plus from '@phosphor/plus.svg';
import Trash from '@phosphor/trash.svg';
import { Button } from '@ui';
import { Index, Show } from 'solid-js';
import {
  AVAILABILITY_STEP_MINUTES,
  type AvailabilityIssue,
} from '../core/availability';
import type { AvailabilityHourRange } from '../core/availability-selection';
import { MAX_UNAVAILABLE_WINDOWS } from '../core/types';
import { AvailabilityFieldRow } from './availability-field-row';
import { AvailabilityTypePicker } from './availability-type-picker';
import { CheckField, Field, TextInput } from './fields';

/** Edit a complete day's hours without choosing defaults for differing dates. */
export function AvailabilityHoursEditor(props: {
  ranges?: AvailabilityHourRange[];
  issue?: AvailabilityIssue;
  count: number;
  disabled: boolean;
  onChange: (ranges: AvailabilityHourRange[]) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  let content!: HTMLElement;
  let addButton!: HTMLButtonElement;
  const update = (index: number, change: Partial<AvailabilityHourRange>) =>
    props.onChange(
      (props.ranges ?? []).map((range, i) =>
        i === index ? { ...range, ...change } : range
      )
    );
  const remove = (index: number) => {
    const remaining = (props.ranges ?? []).filter((_, i) => i !== index);
    props.onChange(remaining);
    queueMicrotask(() => {
      if (!content.isConnected) return;
      const row = content.querySelectorAll<HTMLElement>(
        '[data-availability-range]'
      )[Math.min(index, remaining.length - 1)];
      const control =
        row?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ??
        addButton;
      control.focus();
    });
  };
  return (
    <section
      ref={content}
      aria-label="Edit selected availability"
      class="flex min-w-0 flex-col gap-4"
    >
      <fieldset disabled={props.disabled} class="flex min-w-0 flex-col gap-5">
        <Index each={props.ranges ?? []}>
          {(range, index) => (
            <AvailabilityFieldRow icon={<Clock />}>
              <div
                role="group"
                aria-label={`Hours range ${index + 1}`}
                data-availability-range
                class="flex min-w-0 flex-col gap-3"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <AvailabilityTypePicker
                    label={`Range ${index + 1} availability`}
                    mode={range().mode}
                    disabled={props.disabled}
                    onChange={(mode) => update(index, { mode })}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    label={`Remove range ${index + 1}`}
                    onClick={() => remove(index)}
                  >
                    <Trash class="size-4" />
                  </Button>
                </div>
                <Show when={!range().allDay}>
                  <div class="grid min-w-0 grid-cols-2 gap-3">
                    <Field label="Start" class="min-w-0 gap-1 text-xs">
                      <TextInput
                        type="time"
                        step={AVAILABILITY_STEP_MINUTES * 60}
                        aria-label={`Start time ${index + 1}`}
                        class="h-9 w-full min-w-0 text-xs"
                        value={range().start}
                        onInput={(event) =>
                          update(index, { start: event.currentTarget.value })
                        }
                      />
                    </Field>
                    <Field label="End" class="min-w-0 gap-1 text-xs">
                      <TextInput
                        type="time"
                        step={AVAILABILITY_STEP_MINUTES * 60}
                        aria-label={`End time ${index + 1}`}
                        class="h-9 w-full min-w-0 text-xs"
                        value={range().end}
                        onInput={(event) =>
                          update(index, { end: event.currentTarget.value })
                        }
                      />
                    </Field>
                  </div>
                </Show>
                <CheckField
                  label="All day"
                  class="text-xs"
                  checked={!!range().allDay}
                  onChange={(allDay) => update(index, { allDay })}
                />
              </div>
            </AvailabilityFieldRow>
          )}
        </Index>
        <Show when={!props.ranges?.length}>
          <p class="text-xs leading-relaxed text-ink-muted">
            {props.ranges
              ? 'No hours set. These dates will be blank and non-bookable.'
              : 'Add hours to set the same schedule for these dates.'}
          </p>
        </Show>
        <Button
          ref={addButton}
          variant="outline"
          size="sm"
          class="self-start"
          disabled={(props.ranges?.length ?? 0) >= 8 + MAX_UNAVAILABLE_WINDOWS}
          onClick={() =>
            props.onChange([
              ...(props.ranges ?? []),
              {
                mode:
                  (props.ranges?.filter((range) => range.mode === 'available')
                    .length ?? 0) < 8
                    ? 'available'
                    : 'unavailable',
                start: '',
                end: '',
              },
            ])
          }
        >
          <Plus class="size-4" />
          Add hours
        </Button>
        <Show when={props.issue}>
          {(issue) => (
            <p
              role="alert"
              class="rounded-lg bg-failure-bg p-3 text-xs leading-relaxed text-failure"
            >
              {issue().message}
            </p>
          )}
        </Show>
        <p class="text-xs leading-relaxed text-ink-muted">
          {props.count > 1
            ? 'Replaces all hours on these dates. Weekly hours stay unchanged.'
            : 'Changes this date only. Weekly hours stay unchanged.'}
        </p>
        <div class="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button
            variant="cta"
            size="sm"
            disabled={!props.ranges}
            onClick={props.onApply}
          >
            {props.count > 1 ? `Apply to ${props.count} days` : 'Update hours'}
          </Button>
        </div>
      </fieldset>
    </section>
  );
}
