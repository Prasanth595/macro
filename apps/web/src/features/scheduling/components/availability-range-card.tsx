import type { JSX } from 'solid-js';
import type { AvailabilityChange } from '../core/availability';
import type { TimeWindow } from '../core/types';
import { AvailabilityRangeContent } from './availability-range-content';

/** A calendar range; the schedule view owns its details and inline editor. */
export function AvailabilityRangeCard(props: {
  change: AvailabilityChange;
  label: string;
  inactive?: boolean;
  draft?: boolean;
  transparent?: boolean;
  entryStart?: string;
  overridden: boolean;
  disabled: boolean;
  selected: boolean;
  overlaps: TimeWindow[];
  style: JSX.CSSProperties;
  onMoveStart?: (event: PointerEvent) => void;
  onSelect: (anchor: HTMLElement, event: MouseEvent) => void;
}) {
  const unavailable = () => props.change.mode === 'unavailable';
  const title = () => (unavailable() ? 'Unavailable' : 'Available');
  const gray = () => unavailable() || !!props.inactive;
  const timeLabel = () =>
    props.change.allDay
      ? 'All day'
      : `${props.change.window.start}–${props.change.window.end}`;
  return (
    <button
      type="button"
      style={props.style}
      data-availability-range=""
      data-availability-draft={props.draft ? '' : undefined}
      aria-hidden={props.draft || undefined}
      tabIndex={props.draft ? -1 : undefined}
      disabled={props.disabled}
      aria-label={`${props.label}, ${unavailable() ? 'unavailable' : 'available'}, ${timeLabel()}`}
      aria-description={`${props.overridden ? 'Date override' : 'Repeats every week'}${props.overlaps.length ? '. Overlapping hours' : ''}`}
      title={
        `${title()} · ${timeLabel()}` +
        (props.overlaps.length ? ' · Overlapping hours' : '') +
        (!props.inactive && !props.change.allDay ? ' · Drag to move' : '')
      }
      aria-haspopup="dialog"
      aria-expanded={props.selected}
      onPointerDown={props.onMoveStart}
      onClick={(event) => props.onSelect(event.currentTarget, event)}
      class="absolute inset-x-1.5 z-2 flex min-h-4 flex-col rounded-md border border-panel px-1.5 py-0.5 text-left text-xs leading-tight outline-none focus-visible:ring-1 focus-visible:ring-ink-muted"
      classList={{
        'overflow-clip': !!props.draft || !props.overlaps.length,
        'overflow-visible': !props.draft && props.overlaps.length > 0,
        'pointer-events-none': !!props.draft,
        'bg-accent': !props.transparent && !gray(),
        'bg-edge': !props.transparent && gray(),
        'text-accent-contrast': !gray(),
        'text-ink': gray(),
        'border-transparent': !!props.transparent && !props.overlaps.length,
        'cursor-grab active:cursor-grabbing':
          !props.disabled && !props.inactive && !props.change.allDay,
        'border-dashed': unavailable(),
        'text-ink-muted': unavailable(),
        'border-failure': props.overlaps.length > 0,
        'ring-2 ring-inset ring-ink-muted': props.selected,
      }}
    >
      <AvailabilityRangeContent
        change={props.change}
        gray={gray()}
        overlaps={props.overlaps}
        pushLabel={!props.draft}
        entryStart={props.entryStart}
      />
    </button>
  );
}
