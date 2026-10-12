import { Show } from 'solid-js';
import type { AvailabilityChange } from '../core/availability';
import {
  type AvailabilityMonthRun,
  type AvailabilityTimeFormat,
  availabilityTimeLabel,
  formatAvailabilityTime,
} from '../core/availability-month';

export function AvailabilitySelectionBar(props: {
  run: AvailabilityMonthRun;
  preview: Pick<AvailabilityChange, 'mode' | 'window' | 'allDay'>;
  timeFormat: AvailabilityTimeFormat;
  conflicting: boolean;
}) {
  const window = () =>
    props.preview.allDay
      ? { start: '00:00', end: '23:59' }
      : props.preview.window;
  const hours = () => availabilityTimeLabel(window(), props.timeFormat);
  const tall = () =>
    props.run.dates.length === 1 &&
    props.timeFormat === '12h' &&
    hours() !== 'All day';
  return (
    <div
      data-availability-selection
      data-mode={props.preview.mode}
      data-start={props.run.dates[0]}
      data-end={props.run.dates.at(-1)}
      aria-label={`${props.preview.mode}, ${hours()}, ${props.run.dates[0]}–${props.run.dates.at(-1)}`}
      class="pointer-events-none relative z-10 mx-2 mt-7 flex min-w-0 flex-wrap content-center items-center self-start rounded-md px-1.5 text-[10px] leading-3 tabular-nums"
      classList={{
        'h-6': !tall(),
        'h-8': tall(),
        'bg-accent text-panel': props.preview.mode === 'available',
        'bg-edge text-ink': props.preview.mode === 'unavailable',
        'ring-1 ring-failure': props.conflicting,
      }}
      style={{
        'grid-row': Math.floor(props.run.startIndex / 7) + 1,
        'grid-column': `${(props.run.startIndex % 7) + 1} / span ${props.run.dates.length}`,
      }}
    >
      <Show when={hours() !== 'All day'} fallback={<span>All day</span>}>
        <span class="whitespace-nowrap">
          {formatAvailabilityTime(window().start, props.timeFormat)}
        </span>
        <span class="whitespace-nowrap">
          –{formatAvailabilityTime(window().end, props.timeFormat)}
        </span>
      </Show>
    </div>
  );
}
