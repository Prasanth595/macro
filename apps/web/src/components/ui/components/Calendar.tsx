import CorvuCalendar, {
  type RootChildrenBaseProps as CorvuCalendarRootChildrenBaseProps,
  type RootRangeProps as CorvuCalendarRootRangeProps,
  type RootSingleProps as CorvuCalendarRootSingleProps,
} from '@corvu/calendar';
import ArrowDownIcon from '@icon/system/regular/arrow-down.svg';
import ArrowUpIcon from '@icon/system/regular/arrow-up.svg';
import CaretDownIcon from '@icon/system/regular/caret-down.svg';
import CaretLeftIcon from '@icon/system/regular/caret-left.svg';
import CaretRightIcon from '@icon/system/regular/caret-right.svg';
import CheckIcon from '@icon/system/regular/check.svg';
import {
  createMemo,
  createSignal,
  Index,
  onCleanup,
  onMount,
  Show,
  splitProps,
} from 'solid-js';
import { Virtualizer, type VirtualizerHandle } from 'virtua/solid';
import { cn } from '../utils/classname';
import { Button } from './Button';
import { Dropdown } from './Dropdown';

const formatWeekdayLong = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
}).format;
const formatWeekdayNarrow = new Intl.DateTimeFormat(undefined, {
  weekday: 'narrow',
}).format;

type HighlightedRange = { start: Date; end: Date };

const isDateInRange = (date: Date, range: HighlightedRange | undefined) =>
  range !== undefined && date >= range.start && date < range.end;

const offsetDate = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const isRangeStart = (date: Date, range: HighlightedRange | undefined) =>
  isDateInRange(date, range) && !isDateInRange(offsetDate(date, -1), range);

const isRangeEnd = (date: Date, range: HighlightedRange | undefined) =>
  isDateInRange(date, range) && !isDateInRange(offsetDate(date, 1), range);

export interface CalendarMonthSelectorProps {
  /** Month currently displayed by the calendar. */
  month: Date;
  /** Displays another month. */
  onChange: (month: Date) => void;
}

export type CalendarProps = Omit<
  CorvuCalendarRootSingleProps,
  'children' | 'mode'
> & {
  /** Additional classes applied to the calendar container. */
  class?: string;
  /** Optional end-exclusive date range to highlight. */
  highlightedRange?: HighlightedRange;
};

/** An accessible, single-date calendar styled with the app's semantic tokens. */
export function Calendar(props: CalendarProps) {
  const [local, calendarProps] = splitProps(props, [
    'class',
    'highlightedRange',
  ]);
  const initialFallbackDate = calendarProps.value ?? new Date();

  return (
    <CorvuCalendar
      mode="single"
      {...calendarProps}
      initialMonth={calendarProps.initialMonth ?? initialFallbackDate}
      initialFocusedDay={calendarProps.initialFocusedDay ?? initialFallbackDate}
    >
      {(calendar) => (
        <CalendarMonth
          calendar={calendar}
          class={local.class}
          highlightedRange={local.highlightedRange}
        />
      )}
    </CorvuCalendar>
  );
}

/** A day range as the range calendar holds it; either end is null until picked. */
export type CalendarRange = { from: Date | null; to: Date | null };

export type RangeCalendarProps = Omit<
  CorvuCalendarRootRangeProps,
  'children' | 'mode'
> & {
  /** Additional classes applied to the calendar container. */
  class?: string;
  /**
   * Handles a picked day in place of the calendar's own picking, for callers
   * that decide which end a day sets; `value` then shows their range.
   */
  onPickDay?: (day: Date) => void;
  /** The range picking `day` would make, drawn while a mouse hovers it. */
  previewPick?: (day: Date) => CalendarRange;
};

/**
 * An accessible calendar picking a range of days: the first day picked starts
 * it, the second ends it, in either order. The days between the ends form one
 * band, with the ends as solid circles on it.
 */
export function RangeCalendar(props: RangeCalendarProps) {
  const [local, calendarProps] = splitProps(props, [
    'class',
    'onPickDay',
    'previewPick',
  ]);
  const initialFallbackDate = calendarProps.value?.from ?? new Date();

  return (
    <CorvuCalendar
      mode="range"
      {...calendarProps}
      initialMonth={calendarProps.initialMonth ?? initialFallbackDate}
      initialFocusedDay={calendarProps.initialFocusedDay ?? initialFallbackDate}
    >
      {(calendar) => (
        <CalendarMonth
          calendar={calendar}
          class={local.class}
          range={calendar.mode === 'range' ? calendar.value : undefined}
          onPickDay={local.onPickDay}
          previewPick={local.previewPick}
        />
      )}
    </CorvuCalendar>
  );
}

/** Where a day sits in a range's band; `undefined` off it or for a one-day range. */
type BandPart = 'start' | 'between' | 'end';

const isSameDay = (left: Date, right: Date | null) =>
  right !== null &&
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

function bandPart(day: Date, range: CalendarRange): BandPart | undefined {
  if (!range.from || !range.to || isSameDay(range.from, range.to)) return;
  if (isSameDay(day, range.from)) return 'start';
  if (isSameDay(day, range.to)) return 'end';
  if (day > range.from && day < range.to) return 'between';
}

const WEEK_LENGTH = 7;

/** One month's header and days, for a calendar of either mode. */
function CalendarMonth(props: {
  calendar: CorvuCalendarRootChildrenBaseProps;
  class?: string;
  highlightedRange?: HighlightedRange;
  /** The range shown, styling the picked days as its ends and band. */
  range?: CalendarRange;
  onPickDay?: (day: Date) => void;
  previewPick?: (day: Date) => CalendarRange;
}) {
  const [hoveredDay, setHoveredDay] = createSignal<Date>();
  const shownRange = (): CalendarRange | undefined => {
    const day = hoveredDay();
    return (day && props.previewPick?.(day)) || props.range;
  };
  const dataIf = (condition: boolean | undefined) =>
    condition ? '' : undefined;

  return (
    <div class={cn('w-full min-w-0 text-ink', props.class)}>
      <div class="flex items-center gap-2">
        <CorvuCalendar.Label class="min-w-0 flex-1">
          <CalendarMonthDropdown
            month={props.calendar.month}
            onChange={props.calendar.setMonth}
          />
        </CorvuCalendar.Label>
        <div class="ml-auto flex shrink-0 items-center gap-0.5">
          <CorvuCalendar.Nav
            as={Button}
            variant="ghost"
            size="icon-sm"
            action="prev-month"
            aria-label="Go to previous month"
          >
            <CaretLeftIcon class="size-3" />
          </CorvuCalendar.Nav>
          <CorvuCalendar.Nav
            as={Button}
            variant="ghost"
            size="icon-sm"
            action="next-month"
            aria-label="Go to next month"
          >
            <CaretRightIcon class="size-3" />
          </CorvuCalendar.Nav>
        </div>
      </div>

      <CorvuCalendar.Table
        class="mt-2 w-full table-fixed border-collapse"
        onPointerLeave={() => setHoveredDay(undefined)}
      >
        <thead>
          <tr>
            <Index each={props.calendar.weekdays}>
              {(weekday) => (
                <CorvuCalendar.HeadCell
                  abbr={formatWeekdayLong(weekday())}
                  class="h-7 text-center text-[10px] font-medium text-ink-extra-muted"
                >
                  {formatWeekdayNarrow(weekday())}
                </CorvuCalendar.HeadCell>
              )}
            </Index>
          </tr>
        </thead>
        <tbody>
          <Index each={props.calendar.weeks}>
            {(week) => (
              <tr>
                <Index each={week()}>
                  {(day, column) => {
                    const band = () => {
                      const range = shownRange();
                      return range && bandPart(day(), range);
                    };
                    return (
                      <CorvuCalendar.Cell
                        class={cn(
                          'p-0 text-center data-highlighted-range:bg-active data-highlighted-range-start:rounded-l-md data-highlighted-range-end:rounded-r-md',
                          props.range &&
                            'relative data-band:before:pointer-events-none data-band:before:absolute data-band:before:top-1/2 data-band:before:right-0 data-band:before:left-0 data-band:before:h-7 data-band:before:-translate-y-1/2 data-band:before:bg-accent/16 data-[band=end]:before:right-1/2 data-[band=start]:before:left-1/2 data-band-cap-left:before:left-0.5 data-band-cap-left:before:rounded-l-full data-band-cap-right:before:right-0.5 data-band-cap-right:before:rounded-r-full'
                        )}
                        data-band={band()}
                        data-band-cap-left={dataIf(
                          band() !== 'start' &&
                            band() !== undefined &&
                            column === 0
                        )}
                        data-band-cap-right={dataIf(
                          band() !== 'end' &&
                            band() !== undefined &&
                            column === WEEK_LENGTH - 1
                        )}
                        data-highlighted-range={dataIf(
                          isDateInRange(day(), props.highlightedRange)
                        )}
                        data-highlighted-range-end={dataIf(
                          isRangeEnd(day(), props.highlightedRange)
                        )}
                        data-highlighted-range-start={dataIf(
                          isRangeStart(day(), props.highlightedRange)
                        )}
                      >
                        <CorvuCalendar.CellTrigger
                          day={day()}
                          month={props.calendar.month}
                          data-highlighted-range={dataIf(
                            isDateInRange(day(), props.highlightedRange)
                          )}
                          data-start-day={dataIf(
                            isSameDay(day(), shownRange()?.from ?? null)
                          )}
                          data-end-day={dataIf(
                            isSameDay(day(), shownRange()?.to ?? null)
                          )}
                          onPointerEnter={(event: PointerEvent) => {
                            if (event.pointerType === 'mouse')
                              setHoveredDay(day());
                          }}
                          onClick={(event: MouseEvent) => {
                            if (!props.onPickDay) return;
                            // Corvu skips its own picking for a handled click.
                            event.preventDefault();
                            setHoveredDay(undefined);
                            props.onPickDay(day());
                          }}
                          class={cn(
                            'mx-auto flex size-7 items-center justify-center rounded-md text-xs text-ink-muted outline-none hover:bg-hover hover:text-ink focus-visible:ring focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-30 data-today:border data-today:border-accent data-today:font-semibold data-highlighted-range:text-ink',
                            props.range
                              ? 'relative rounded-full data-selected:text-ink data-start-day:bg-accent! data-start-day:text-surface! data-end-day:bg-accent! data-end-day:text-surface!'
                              : 'data-selected:bg-accent! data-selected:text-surface!'
                          )}
                        >
                          {day().getDate()}
                        </CorvuCalendar.CellTrigger>
                      </CorvuCalendar.Cell>
                    );
                  }}
                </Index>
              </tr>
            )}
          </Index>
        </tbody>
      </CorvuCalendar.Table>
    </div>
  );
}

const MONTH_RANGE_YEARS = 100;
const MONTH_OPTION_HEIGHT = 32;
const DRAWER_MONTH_OPTION_HEIGHT = 44;

export const formatCalendarMonth = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
}).format;

type MonthOption = {
  date: Date;
  label: string;
  value: string;
};

type MonthOptionRange = {
  options: MonthOption[];
  startYear: number;
};

export type CalendarMonthMenuProps = CalendarMonthSelectorProps & {
  /** Semantic presentation used for month options. */
  presentation?: 'menu' | 'radio-group';
  /** Action invoked by the drawer's Go To Today button. */
  onToday?: () => void;
};

/** Dropdown presentation for selecting a calendar month. */
function CalendarMonthDropdown(props: CalendarMonthSelectorProps) {
  const [open, setOpen] = createSignal(false);

  const selectMonth = (month: Date) => {
    props.onChange(month);
    setOpen(false);
  };

  return (
    <Dropdown open={open()} onOpenChange={setOpen} placement="bottom-start">
      <Dropdown.Trigger
        aria-label="Choose month"
        variant="ghost"
        size="sm"
        class="max-w-full min-w-0 justify-start"
      >
        <span class="min-w-0 truncate">{formatCalendarMonth(props.month)}</span>
        <CaretDownIcon class="size-3 shrink-0 text-ink-muted" />
      </Dropdown.Trigger>
      <Dropdown.Content class="min-w-40 p-1">
        <CalendarMonthMenu month={props.month} onChange={selectMonth} />
      </Dropdown.Content>
    </Dropdown>
  );
}

const monthValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const createMonthOptionRange = (
  selectedMonth: Date,
  todayMonth: Date
): MonthOptionRange => {
  const startYear =
    Math.min(selectedMonth.getFullYear(), todayMonth.getFullYear()) -
    MONTH_RANGE_YEARS;
  const endYear =
    Math.max(selectedMonth.getFullYear(), todayMonth.getFullYear()) +
    MONTH_RANGE_YEARS;

  return {
    startYear,
    options: Array.from(
      { length: (endYear - startYear + 1) * 12 },
      (_, offset) => {
        const date = new Date(startYear, offset, 1);

        return {
          date,
          label: formatCalendarMonth(date),
          value: monthValue(date),
        };
      }
    ),
  };
};

const monthIndex = (month: Date, startYear: number) =>
  (month.getFullYear() - startYear) * 12 + month.getMonth();

/** Virtualized month menu reusable across dropdown and drawer presentations. */
export function CalendarMonthMenu(props: CalendarMonthMenuProps) {
  const now = new Date();
  const todayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayValue = monthValue(todayMonth);
  const [virtualizer, setVirtualizer] = createSignal<VirtualizerHandle>();
  const [hasScrolled, setHasScrolled] = createSignal(false);
  const [isTodayVisible, setIsTodayVisible] = createSignal(false);
  const [todayDirection, setTodayDirection] = createSignal<'up' | 'down'>(
    props.month > todayMonth ? 'up' : 'down'
  );
  let initialPositionComplete = false;
  let focusFrame: number | undefined;
  let menu!: HTMLDivElement;

  const range = createMemo(() =>
    createMonthOptionRange(props.month, todayMonth)
  );
  const options = () => range().options;
  const selectedValue = () => monthValue(props.month);
  const optionHeight = () =>
    props.presentation === 'radio-group'
      ? DRAWER_MONTH_OPTION_HEIGHT
      : MONTH_OPTION_HEIGHT;
  const selectedIndex = () => monthIndex(props.month, range().startYear);
  const todayIndex = () => monthIndex(todayMonth, range().startYear);

  const centeredOffset = (index: number) => {
    const handle = virtualizer();
    if (!handle) return index * optionHeight();

    return Math.max(
      0,
      handle.getItemOffset(index) -
        (handle.viewportSize - handle.getItemSize(index)) / 2
    );
  };

  const scrollToIndex = (index: number) => {
    if (index < 0 || index >= options().length) return;
    virtualizer()?.scrollToIndex(index, { align: 'center' });
  };

  const focusIndex = (index: number) => {
    scrollToIndex(index);
    if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);

    focusFrame = requestAnimationFrame(() => {
      focusFrame = undefined;
      menu.querySelector<HTMLElement>(`[data-month-index="${index}"]`)?.focus();
    });
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const option = (event.target as Element).closest<HTMLElement>(
      '[data-month-index]'
    );
    if (!option || !menu.contains(option)) return;

    const currentIndex = Number(option.dataset.monthIndex);
    let nextIndex: number | undefined;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = Math.min(options().length - 1, currentIndex + 1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = options().length - 1;
    }

    if (nextIndex === undefined) return;

    event.preventDefault();
    focusIndex(nextIndex);
  };

  const handleScroll = (offset: number) => {
    if (!initialPositionComplete) return;

    const handle = virtualizer();
    const currentTodayIndex = todayIndex();

    if (handle) {
      const todayStart = handle.getItemOffset(currentTodayIndex);
      const todayEnd = todayStart + handle.getItemSize(currentTodayIndex);

      setIsTodayVisible(
        todayEnd > offset && todayStart < offset + handle.viewportSize
      );
      setTodayDirection(
        offset > centeredOffset(currentTodayIndex) ? 'up' : 'down'
      );
    }

    if (
      !hasScrolled() &&
      Math.abs(offset - centeredOffset(selectedIndex())) > 1
    ) {
      setHasScrolled(true);
    }
  };

  onMount(() => {
    let positionedFrame: number | undefined;
    const frame = requestAnimationFrame(() => {
      scrollToIndex(selectedIndex());
      positionedFrame = requestAnimationFrame(() => {
        initialPositionComplete = true;
        menu
          .querySelector<HTMLElement>(`[data-month-index="${selectedIndex()}"]`)
          ?.focus({ preventScroll: true });
      });
    });

    onCleanup(() => {
      cancelAnimationFrame(frame);
      if (positionedFrame !== undefined) cancelAnimationFrame(positionedFrame);
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
    });
  });

  return (
    <div
      ref={menu}
      class="relative"
      role={props.presentation === 'radio-group' ? 'radiogroup' : undefined}
      aria-label={
        props.presentation === 'radio-group' ? 'Choose month' : undefined
      }
      onKeyDown={handleKeyDown}
    >
      <div
        class={cn(
          'h-72 overflow-y-auto overscroll-contain',
          props.presentation === 'radio-group' && 'rounded-[20px]'
        )}
        style={{ contain: 'strict' }}
      >
        <Virtualizer
          data={options()}
          itemSize={optionHeight()}
          onScroll={handleScroll}
          ref={setVirtualizer}
        >
          {(option) => {
            const index = () => monthIndex(option.date, range().startYear);
            const selected = () => option.value === selectedValue();

            return (
              <button
                type="button"
                role={
                  props.presentation === 'radio-group'
                    ? 'radio'
                    : 'menuitemradio'
                }
                aria-checked={selected()}
                aria-current={option.value === todayValue ? 'date' : undefined}
                data-month-index={index()}
                class={cn(
                  'flex w-full items-center gap-1.5 text-left outline-none',
                  props.presentation === 'radio-group'
                    ? 'relative h-11 rounded-[20px] px-3 text-sm text-ink transition-colors hover:bg-ink/6 active:bg-ink/10 aria-checked:bg-ink/8 focus-visible:outline-2 focus-visible:outline-accent'
                    : 'h-8 rounded-lg px-2 text-xs hover:bg-hover focus-visible:bg-hover',
                  props.presentation !== 'radio-group' &&
                    (selected() ? 'text-accent' : 'text-ink')
                )}
                tabIndex={selected() ? 0 : -1}
                onClick={() => props.onChange(option.date)}
              >
                <span
                  aria-hidden="true"
                  class="flex size-2 shrink-0 items-center justify-center"
                >
                  <Show when={option.value === todayValue}>
                    <span class="size-1.5 rounded-full bg-accent" />
                  </Show>
                </span>
                <span>{option.label}</span>
                <CheckIcon
                  class="ml-auto size-3.5 text-accent"
                  classList={{ invisible: !selected() }}
                />
              </button>
            );
          }}
        </Virtualizer>
      </div>

      <Show when={props.presentation === 'radio-group'}>
        <div class="flex pt-3">
          <Button
            fullWidth
            variant="ghost"
            size="sm"
            depth={3}
            class="min-h-11 bg-ink/6 px-3 text-ink"
            label="Go To Today"
            onClick={() => {
              if (props.onToday) {
                props.onToday();
                return;
              }
              focusIndex(todayIndex());
            }}
          >
            Go To Today
          </Button>
        </div>
      </Show>

      <Show
        when={
          props.presentation !== 'radio-group' &&
          hasScrolled() &&
          !isTodayVisible()
        }
      >
        <div class="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center">
          <button
            type="button"
            class={cn(
              'pointer-events-auto flex min-w-16 items-center justify-center gap-1.5 rounded-full border border-edge-muted bg-surface px-3 text-ink shadow-menu hover:bg-active',
              props.presentation === 'radio-group'
                ? 'h-11 text-sm'
                : 'h-8 text-xs'
            )}
            data-direction={todayDirection()}
            onClick={() => focusIndex(todayIndex())}
          >
            <Show
              when={todayDirection() === 'up'}
              fallback={<ArrowDownIcon aria-hidden="true" class="size-3" />}
            >
              <ArrowUpIcon aria-hidden="true" class="size-3" />
            </Show>
            Today
          </button>
        </div>
      </Show>
    </div>
  );
}
