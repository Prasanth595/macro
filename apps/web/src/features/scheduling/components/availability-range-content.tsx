import { createEffect, on, onCleanup } from 'solid-js';
import { type AvailabilityChange, timeMinutes } from '../core/availability';
import type { TimeWindow } from '../core/types';
import { AvailabilityOverlapPattern } from './availability-overlap-pattern';

/** Reserve space below conflicts instead of floating labels over their hatching. */
export function AvailabilityRangeContent(props: {
  change: AvailabilityChange;
  gray: boolean;
  overlaps: TimeWindow[];
  pushLabel?: boolean;
  entryStart?: string;
}) {
  let label!: HTMLDivElement;
  let animation: Animation | undefined;
  // Web Animations moves incoming labels independently from the filtered shapes.
  createEffect(
    on(
      [
        () => props.entryStart,
        () => props.change.window.start,
        () => props.overlaps.length,
      ],
      ([entry, start, overlaps], previous) => {
        if (!entry || overlaps) {
          animation?.cancel();
          return;
        }
        if (
          previous?.[0] === entry &&
          previous[1] === start &&
          previous[2] === overlaps
        )
          return;
        if (
          typeof label?.animate !== 'function' ||
          window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        )
          return;
        const offset =
          (Math.max(0, timeMinutes(entry) - timeMinutes(start)) * 64) / 60;
        if (!offset) {
          animation?.cancel();
          return;
        }
        const from =
          animation?.playState === 'running'
            ? getComputedStyle(label).transform
            : `translateY(${offset}px)`;
        animation?.cancel();
        animation = label.animate(
          [{ transform: from }, { transform: 'translateY(0)' }],
          { duration: 350, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );
      }
    )
  );
  onCleanup(() => animation?.cancel());
  const timeLabel = () =>
    props.change.allDay
      ? 'All day'
      : `${props.change.window.start}–${props.change.window.end}`;
  const labelOffset = () => {
    const last = props.overlaps.at(-1);
    if (props.pushLabel && last) {
      const duration =
        timeMinutes(props.change.window.end) -
        timeMinutes(props.change.window.start);
      return `calc(${((timeMinutes(last.end) - timeMinutes(props.change.window.start)) / duration) * 100}% + 0.375rem)`;
    }
    return props.overlaps.some(
      (overlap) => overlap.start === props.change.window.start
    )
      ? '0.75rem'
      : undefined;
  };
  return (
    <>
      <AvailabilityOverlapPattern
        range={props.change.window}
        overlaps={props.overlaps}
      />
      <div
        aria-hidden="true"
        class="shrink-0"
        style={{ height: labelOffset() ?? '0px' }}
      />
      <div
        ref={label}
        data-availability-label
        class="z-10 -mx-1.5 min-w-0 px-1.5 pt-0.5 pb-1"
        classList={{
          'sticky top-32': !props.pushLabel || !props.overlaps.length,
          relative: !!props.pushLabel && props.overlaps.length > 0,
          'bg-accent': !props.gray,
          'bg-edge': props.gray,
        }}
      >
        <span class="block truncate font-medium">
          {props.change.mode === 'unavailable' ? 'Unavailable' : 'Available'}
        </span>
        <span class="mt-0.5 block truncate text-[11px] tabular-nums opacity-85">
          {timeLabel()}
        </span>
      </div>
    </>
  );
}
