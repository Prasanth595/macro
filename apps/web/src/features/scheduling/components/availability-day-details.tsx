import CalendarBlank from '@phosphor/calendar-blank.svg';
import CircleHalf from '@phosphor/circle-half.svg';
import Clock from '@phosphor/clock.svg';
import Plus from '@phosphor/plus.svg';
import Repeat from '@phosphor/repeat.svg';
import X from '@phosphor/x.svg';
import { Button } from '@ui';
import { For, Show } from 'solid-js';
import type {
  AvailabilityChange,
  AvailabilityState,
  AvailabilityTarget,
} from '../core/availability';
import {
  type AvailabilityTimeFormat,
  availabilityTimeLabel,
} from '../core/availability-month';
import type { TimeWindow } from '../core/types';
import { AvailabilityFieldRow } from './availability-field-row';

/** Edit recurring weekday rules or an explicitly blank date without a popover. */
export function AvailabilityDayDetails(props: {
  target: AvailabilityTarget;
  label: string;
  state: AvailabilityState;
  windows: TimeWindow[];
  unavailable: TimeWindow[];
  timeFormat: AvailabilityTimeFormat;
  disabled: boolean;
  onStateChange: (state: AvailabilityState) => void;
  onSelect: (
    change: AvailabilityChange,
    anchor: HTMLElement,
    drawn?: boolean
  ) => void;
  onClose: () => void;
}) {
  const select = (
    mode: AvailabilityChange['mode'],
    window: TimeWindow,
    anchor: HTMLElement,
    index?: number
  ) =>
    props.onSelect(
      {
        target: props.target,
        mode,
        window,
        index,
        allDay: window.start === '00:00' && window.end === '23:59',
      },
      anchor
    );
  return (
    <section
      aria-label={`${props.label} availability`}
      class="flex min-w-0 flex-col gap-4"
    >
      <AvailabilityFieldRow icon={<CalendarBlank />}>
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-base font-semibold leading-6">{props.label}</h3>
          <Button
            variant="ghost"
            size="icon-sm"
            label="Close day details"
            onClick={props.onClose}
          >
            <X class="size-4" />
          </Button>
        </div>
      </AvailabilityFieldRow>
      <AvailabilityFieldRow icon={<CircleHalf />}>
        <div
          role="group"
          aria-label="Day availability state"
          class="flex gap-1 rounded-lg border border-edge-muted p-1"
        >
          <For
            each={[
              { value: 'unset' as const, label: 'Unset' },
              { value: 'available' as const, label: 'Available' },
              { value: 'unavailable' as const, label: 'Unavailable' },
            ]}
          >
            {(option) => (
              <Button
                variant="ghost"
                size="sm"
                class="min-h-9 min-w-0 flex-1 rounded-md px-1 text-xs"
                classList={{
                  'bg-surface-1 text-ink':
                    props.state === option.value && option.value === 'unset',
                  'bg-accent text-accent-contrast':
                    props.state === option.value &&
                    option.value === 'available',
                  'bg-edge text-ink':
                    props.state === option.value &&
                    option.value === 'unavailable',
                }}
                aria-pressed={props.state === option.value}
                disabled={props.disabled}
                onClick={() => {
                  if (option.value !== props.state)
                    props.onStateChange(option.value);
                }}
              >
                {option.label}
              </Button>
            )}
          </For>
        </div>
      </AvailabilityFieldRow>
      <AvailabilityFieldRow icon={<Repeat />}>
        <p class="text-xs leading-relaxed text-ink-muted">
          {props.target.kind === 'weekly'
            ? 'Repeats every week. Date overrides stay unchanged.'
            : 'This date only. Weekly hours stay unchanged.'}
        </p>
      </AvailabilityFieldRow>
      <Show when={props.state === 'unset'}>
        <p class="text-xs leading-relaxed text-ink-muted">
          Nothing is set. This day is blank and non-bookable.
        </p>
      </Show>
      <AvailabilityFieldRow icon={<Clock />}>
        <div class="flex min-w-0 flex-col gap-4">
          <For each={props.windows}>
            {(window, index) => (
              <Button
                variant="outline"
                size="md"
                class="min-h-10 w-full justify-start text-left"
                disabled={props.disabled}
                onClick={(event) =>
                  select('available', window, event.currentTarget, index())
                }
              >
                <span class="size-2 shrink-0 rounded-sm bg-accent" />
                {availabilityTimeLabel(window, props.timeFormat)}
                <span class="ml-auto text-xs text-ink-muted">Available</span>
              </Button>
            )}
          </For>
          <For each={props.unavailable}>
            {(window) => (
              <Button
                variant="outline"
                size="md"
                class="min-h-10 w-full justify-start text-left"
                disabled={props.disabled}
                onClick={(event) =>
                  select('unavailable', window, event.currentTarget)
                }
              >
                <span class="size-2 shrink-0 rounded-sm bg-edge" />
                {availabilityTimeLabel(window, props.timeFormat)}
                <span class="ml-auto text-xs text-ink-muted">Unavailable</span>
              </Button>
            )}
          </For>
          <Button
            variant="outline"
            size="sm"
            class="min-h-10 w-full"
            disabled={props.disabled}
            onClick={(event) =>
              props.onSelect(
                {
                  target: props.target,
                  mode: 'available',
                  window: { start: '09:00', end: '17:00' },
                },
                event.currentTarget,
                true
              )
            }
          >
            <Plus class="size-4" />
            Add hours
          </Button>
        </div>
      </AvailabilityFieldRow>
    </section>
  );
}
