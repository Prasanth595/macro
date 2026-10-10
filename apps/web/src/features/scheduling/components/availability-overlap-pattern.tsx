import { Index, type JSX } from 'solid-js';
import { timeMinutes } from '../core/availability';
import type { TimeWindow } from '../core/types';

export function OverlapHatch(props: {
  class?: string;
  style?: JSX.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      class={props.class}
      style={{
        ...props.style,
        'background-image':
          'repeating-linear-gradient(45deg, transparent 0 11px, var(--color-failure) 11px 12px)',
      }}
    />
  );
}

/** Mark only the intersecting hours without replacing the solid range color. */
export function AvailabilityOverlapPattern(props: {
  range: TimeWindow;
  overlaps: TimeWindow[];
}) {
  const duration = () =>
    timeMinutes(props.range.end) - timeMinutes(props.range.start);
  return (
    <Index each={props.overlaps}>
      {(overlap) => (
        <OverlapHatch
          class="pointer-events-none absolute inset-x-0 border-y border-failure transition-[top,height] duration-300 ease-out motion-reduce:transition-none"
          style={{
            top: `${((timeMinutes(overlap().start) - timeMinutes(props.range.start)) / duration()) * 100}%`,
            height: `${((timeMinutes(overlap().end) - timeMinutes(overlap().start)) / duration()) * 100}%`,
          }}
        />
      )}
    </Index>
  );
}
