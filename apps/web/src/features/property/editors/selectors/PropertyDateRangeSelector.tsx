import type { DateRangeValue } from '@property/types';
import { useAutoFocus } from '@property/utils/focus';
import {
  formatDate,
  formatTimeRangeDuration,
} from '@property/utils/formatting';
import {
  Button,
  type CalendarRange,
  Input,
  RangeCalendar,
  ToggleSwitch,
} from '@ui';
import { format, startOfDay } from 'date-fns';
import { batch, createSignal, Show } from 'solid-js';
import { match } from 'ts-pattern';

type RangeEnd = 'start' | 'end';

/** The range being edited: its days, its ends' `HH:mm` times, and which apply. */
type Draft = CalendarRange & {
  allDay: boolean;
  startTime: string;
  endTime: string;
};

/** Times a range gets when All day is turned off. */
const DEFAULT_START_TIME = '09:00';
const DEFAULT_END_TIME = '17:00';

function draftOf(range: DateRangeValue | null): Draft {
  if (!range)
    return {
      from: null,
      to: null,
      allDay: true,
      startTime: DEFAULT_START_TIME,
      endTime: DEFAULT_END_TIME,
    };
  return {
    from: startOfDay(range.start),
    to: startOfDay(range.end),
    allDay: range.allDay,
    startTime: range.allDay ? DEFAULT_START_TIME : format(range.start, 'HH:mm'),
    endTime: range.allDay ? DEFAULT_END_TIME : format(range.end, 'HH:mm'),
  };
}

function atTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hours,
    minutes
  );
}

/** The range a draft holds once both ends are picked. */
function rangeOf(draft: Draft): DateRangeValue | undefined {
  if (!draft.from || !draft.to) return undefined;
  if (draft.allDay) return { allDay: true, start: draft.from, end: draft.to };
  return {
    allDay: false,
    start: atTime(draft.from, draft.startTime),
    end: atTime(draft.to, draft.endTime),
  };
}

/**
 * The days picking `day` for the active end makes. A start after the end
 * moves the end with it; an end before the start becomes the start, the old
 * start the end, so the range stays in order.
 */
function pickDay(days: CalendarRange, active: RangeEnd, day: Date) {
  return match(active)
    .with('start', () => ({
      from: day,
      to: days.to && day > days.to ? day : days.to,
    }))
    .with('end', () =>
      !days.from
        ? { from: day, to: days.to }
        : day < days.from
          ? { from: day, to: days.from }
          : { from: days.from, to: day }
    )
    .exhaustive();
}

type DateRangeSelectorProps = {
  /** What the range is of, e.g. a column's name, for the calendar's label. */
  label: string;
  selectedRange: DateRangeValue | null;
  /** Every complete change to the range, or `null` once cleared. */
  onSelectRange: (range: DateRangeValue | null) => void;
  /** Called after Clear; picking keeps the selector open. */
  onClose?: () => void;
};

/**
 * Edits a time range: the header's Start and End show each end, with its
 * time unless the range is all day, and the highlighted one is what the next
 * calendar pick sets. Picking a start moves on to the end. Every complete
 * change saves at once; the host closes the selector.
 */
export function PropertyDateRangeSelector(props: DateRangeSelectorProps) {
  const [draft, setDraft] = createSignal(draftOf(props.selectedRange));
  const [active, setActive] = createSignal<RangeEnd>('start');
  const [backwards, setBackwards] = createSignal(false);
  let calendar: HTMLDivElement | undefined;
  // Once the hosting menu has taken focus, start arrow keys on a day.
  useAutoFocus(
    () =>
      calendar?.querySelector<HTMLElement>(
        '[data-corvu-calendar-celltrigger][tabindex="0"]'
      ) ?? undefined
  );

  const duration = () => {
    const range = rangeOf(draft());
    return range && !backwards() ? formatTimeRangeDuration(range) : '';
  };

  /** Takes a changed draft, saving it once complete and in order. */
  const change = (next: Draft) => {
    setDraft(next);
    const changed = rangeOf(next);
    const isBackwards = !!changed && changed.end < changed.start;
    setBackwards(isBackwards);
    if (changed && !isBackwards) props.onSelectRange(changed);
  };

  const pick = (day: Date) =>
    batch(() => {
      change({ ...draft(), ...pickDay(draft(), active(), day) });
      setActive('end');
    });

  const clear = () => {
    props.onSelectRange(null);
    props.onClose?.();
  };

  return (
    <div
      class="flex min-h-0 flex-col"
      // Keep keys from the hosting menu's own navigation; it still closes on
      // Escape and moves on with Tab.
      onKeyDown={(event) => {
        if (event.key !== 'Escape' && event.key !== 'Tab')
          event.stopPropagation();
      }}
    >
      <div class="grid shrink-0 grid-cols-2 gap-1 border-b border-edge-muted p-1.5 text-xs">
        <RangeEndField
          label="Start"
          day={draft().from}
          time={draft().allDay ? undefined : draft().startTime}
          active={active() === 'start'}
          onActivate={() => setActive('start')}
          onTimeChange={(startTime) => change({ ...draft(), startTime })}
        />
        <RangeEndField
          label="End"
          day={draft().to}
          time={draft().allDay ? undefined : draft().endTime}
          active={active() === 'end'}
          onActivate={() => setActive('end')}
          onTimeChange={(endTime) => change({ ...draft(), endTime })}
        />
      </div>
      <Show when={backwards()}>
        <p role="alert" class="px-3 pt-2 text-xs text-failure">
          The end can't be before the start.
        </p>
      </Show>
      <div
        ref={calendar}
        role="group"
        aria-label={`${props.label} range`}
        class="min-h-0 overflow-y-auto px-3 py-2"
      >
        <RangeCalendar
          class="touch:[&_[data-corvu-calendar-celltrigger]]:size-9 touch:[&_[data-corvu-calendar-nav]]:size-9"
          value={draft()}
          onPickDay={pick}
          previewPick={(day) => pickDay(draft(), active(), day)}
          required
          fixedWeeks
        />
      </div>
      <div class="flex shrink-0 items-center gap-2 border-t border-edge-muted px-3 py-1.5 text-xs">
        <ToggleSwitch
          label="All day"
          checked={draft().allDay}
          onChange={(allDay) =>
            change({
              ...draft(),
              allDay,
              ...(!allDay && {
                startTime: DEFAULT_START_TIME,
                endTime: DEFAULT_END_TIME,
              }),
            })
          }
        />
        <span class="ml-auto truncate text-ink-muted">{duration()}</span>
        <Show when={props.selectedRange || draft().from}>
          <Button size="sm" variant="ghost" onClick={clear}>
            Clear
          </Button>
        </Show>
      </div>
    </div>
  );
}

/** One end of the range: its day, or what to pick, and its time when timed. */
function RangeEndField(props: {
  label: string;
  day: Date | null;
  /** The end's `HH:mm` time; `undefined` for an all-day range. */
  time: string | undefined;
  active: boolean;
  onActivate: () => void;
  onTimeChange: (time: string) => void;
}) {
  return (
    <div
      class="flex min-w-0 flex-col gap-1 rounded-md p-1.5"
      classList={{ 'bg-accent/10': props.active }}
    >
      <button
        type="button"
        aria-pressed={props.active}
        class="flex min-w-0 flex-col items-start rounded-sm text-left outline-none focus-visible:ring focus-visible:ring-accent"
        onClick={() => props.onActivate()}
      >
        <span
          classList={{
            'text-accent': props.active,
            'text-ink-extra-muted': !props.active,
          }}
        >
          {props.label}
        </span>
        <span
          class="max-w-full truncate"
          classList={{
            'text-ink': !!props.day,
            'text-ink-placeholder': !props.day,
          }}
        >
          {props.day ? formatDate(props.day) : 'Pick a day'}
        </span>
      </button>
      <Show when={props.time}>
        {(time) => (
          <Input
            type="time"
            size="sm"
            class="[&::-webkit-calendar-picker-indicator]:hidden"
            aria-label={`${props.label} time`}
            value={time()}
            onFocus={() => props.onActivate()}
            onChange={(event) => {
              if (event.currentTarget.value)
                props.onTimeChange(event.currentTarget.value);
            }}
            // Tab steps through the time's own fields.
            onKeyDown={(event) => {
              if (event.key === 'Tab') event.stopPropagation();
            }}
          />
        )}
      </Show>
    </div>
  );
}
