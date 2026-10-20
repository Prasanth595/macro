import { isMobile } from '@core/mobile/isMobile';
import { Popover } from '@kobalte/core/popover';
import ArrowRightIcon from '@phosphor/arrow-right.svg';
import CaretDownIcon from '@phosphor/caret-down.svg';
import { type CalendarRange, RangeCalendar } from '@ui/components/Calendar';
import { Layer } from '@ui/components/Layer';
import { ToggleSwitch } from '@ui/components/ToggleSwitch';
import { cn } from '@ui/utils/classname';
import { createSignal, createUniqueId, Show } from 'solid-js';
import { formatLocalDate, parseLocalDate } from '../../utils/calendar-date';
import { dateLabelFormatter, EventTimeInput } from './EventDateTimeInputs';
import {
  DAY_TIME_OPTIONS,
  dayOffsetBetween,
  type EventTimeOption,
  endTimeOptions,
  endValueFor,
  formatTimeValue,
  selectedTimeOptionId,
  splitLocalDateTime,
  withinEndTimeWindow,
  withLocalDate,
  withLocalTime,
} from './event-time-options';

export interface EventDateTimeRangeFieldsProps {
  start: string;
  end: string;
  allDay: boolean;
  onRangeChange: (start: string, end: string) => void;
  onAllDayChange: (allDay: boolean) => void;
  startDisabled?: boolean;
  endDisabled?: boolean;
  allDayDisabled?: boolean;
  startReadOnly?: boolean;
  endReadOnly?: boolean;
  allDayReadOnly?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

/** One date-range trigger with connected months and both endpoint times. */
export function EventDateTimeRangeFields(props: EventDateTimeRangeFieldsProps) {
  const fieldId = createUniqueId();
  const [open, setOpen] = createSignal(false);
  // Corvu owns two-click selection. An unfinished range stays local to this picker.
  const [selection, setSelection] = createSignal<CalendarRange>();
  const startParts = () => splitLocalDateTime(props.start);
  const endParts = () => splitLocalDateTime(props.end);
  const startDate = () => parseLocalDate(startParts().date);
  const endDate = () => parseLocalDate(endParts().date);
  const [month, setMonth] = createSignal(startDate() ?? new Date());
  const singleMonth = () => isMobile() || startParts().date === endParts().date;
  const canStart = () => !props.startReadOnly && !props.startDisabled;
  const canEnd = () => !props.endReadOnly && !props.endDisabled;
  const canAllDay = () => !props.allDayReadOnly && !props.allDayDisabled;
  const editable = () => canStart() || canEnd() || canAllDay();
  const readOnly = () =>
    props.startReadOnly && props.endReadOnly && props.allDayReadOnly;
  const label = (value: string, fallback: string) => {
    const parts = splitLocalDateTime(value);
    const date = parseLocalDate(parts.date);
    const dateLabel = date ? dateLabelFormatter.format(date) : fallback;
    return props.allDay
      ? dateLabel
      : `${dateLabel} ${formatTimeValue(parts.time) ?? 'Time'}`;
  };
  const currentRange = (): CalendarRange =>
    selection() ?? {
      from: startDate() ?? null,
      to: endDate() ?? null,
    };
  const rangeDayLabel = (date: Date | null, fallback: string) =>
    date ? dateLabelFormatter.format(date) : fallback;
  const changeOpen = (next: boolean) => {
    if (next) setMonth(startDate() ?? new Date());
    setSelection(undefined);
    setOpen(next && editable());
  };
  const publishRange = (start: string, end: string) => {
    setSelection(undefined);
    props.onRangeChange(
      canStart() ? start : props.start,
      canEnd() ? end : props.end
    );
  };
  const dateValue = (value: string, date: Date) =>
    props.allDay
      ? formatLocalDate(date)
      : withLocalDate(value, formatLocalDate(date));
  const changeRange = (range: CalendarRange) => {
    if (!canStart() && !canEnd()) return;
    if (canStart() && canEnd()) {
      if (!range.from || !range.to) {
        setSelection(range);
        return;
      }
      if (
        !isMobile() &&
        singleMonth() &&
        range.from.getTime() !== range.to.getTime()
      ) {
        setMonth(range.from);
      }
      publishRange(
        dateValue(props.start, range.from),
        dateValue(props.end, range.to)
      );
      return;
    }
    // With one locked endpoint, a day click changes only the editable endpoint.
    const day = range.to ?? range.from;
    if (!day) return;
    publishRange(dateValue(props.start, day), dateValue(props.end, day));
  };
  const anchor = () =>
    !props.allDay && withinEndTimeWindow(props.start, props.end)
      ? props.start
      : undefined;
  const endOptions = () =>
    anchor() ? endTimeOptions(startParts().time) : DAY_TIME_OPTIONS;
  const endTimeId = () =>
    selectedTimeOptionId(
      endParts().time,
      anchor() ? dayOffsetBetween(props.start, props.end) : 0
    );
  const changeEndTime = (option: EventTimeOption) => {
    if (!canEnd() || props.allDay) return;
    publishRange(
      props.start,
      anchor()
        ? endValueFor(props.start, option)
        : withLocalTime(props.end, option.value)
    );
  };

  return (
    <Show
      when={!readOnly()}
      fallback={
        <span
          aria-label="Event date and time range"
          class="select-text text-xs text-ink-muted"
        >
          {label(props.start, 'Start date')} → {label(props.end, 'End date')}
          {props.allDay ? ' · All day' : ''}
        </span>
      }
    >
      <Popover
        modal
        open={open() && editable()}
        onOpenChange={changeOpen}
        placement="bottom-start"
        gutter={4}
        flip
        slide
        overlap
        fitViewport
      >
        <Popover.Trigger
          disabled={!editable()}
          aria-label="Edit event date and time range"
          aria-invalid={props.invalid || undefined}
          aria-describedby={props.describedBy}
          title={`${label(props.start, 'Start date')} → ${label(props.end, 'End date')}`}
          class={cn(
            'group inline-flex h-9 w-full min-w-0 items-center gap-1.5 rounded-xl border border-edge-muted bg-control px-2 py-2 text-left text-xs leading-tight text-ink-muted outline-none hover:bg-hover hover:text-ink focus-visible:bg-active focus-visible:text-ink focus-visible:outline-none focus-visible:ring-0 data-expanded:bg-hover data-expanded:text-ink touch:min-h-[44px]',
            props.invalid &&
              'border-failure text-failure hover:text-failure focus-visible:text-failure data-expanded:text-failure'
          )}
        >
          <span class="min-w-0 flex-1 truncate">
            {label(props.start, 'Start date')}
          </span>
          <ArrowRightIcon
            aria-label="to"
            class="size-3.5 shrink-0 text-ink-extra-muted"
          />
          <span class="min-w-0 flex-1 truncate">
            {label(props.end, 'End date')}
          </span>
          <CaretDownIcon class="size-3 shrink-0 text-ink-extra-muted" />
        </Popover.Trigger>
        <Popover.Portal>
          <Layer depth={4}>
            <Popover.Content
              class={cn(
                'portal-scope z-action-menu flex max-h-[var(--kb-popper-content-available-height)] max-w-[var(--kb-popper-content-available-width,calc(100vw-1rem))] min-w-0 flex-col overflow-hidden rounded-2xl border border-edge bg-menu-glass glass menu-open-animation',
                singleMonth() ? 'w-80' : 'w-[40rem]'
              )}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                event.stopPropagation();
                changeOpen(false);
              }}
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <div class="min-h-0 overflow-y-auto overscroll-contain">
                <Popover.Title class="px-4 pt-4 text-xs font-medium text-ink">
                  Event date and time
                </Popover.Title>
                <div class="px-4 pb-4 pt-3">
                  <RangeCalendar
                    required
                    fixedWeeks
                    numberOfMonths={singleMonth() ? 1 : 2}
                    month={month()}
                    onMonthChange={setMonth}
                    value={currentRange()}
                    disabled={() => !canStart() && !canEnd()}
                    onValueChange={changeRange}
                  />
                  <div
                    role="status"
                    class="mt-2 border-t border-edge-muted pt-2"
                  >
                    <span class="block text-xs font-medium text-ink-muted">
                      Selected range
                    </span>
                    <p class="mt-1 text-sm text-ink">
                      {rangeDayLabel(
                        currentRange().from,
                        'Select a start date'
                      )}{' '}
                      → {rangeDayLabel(currentRange().to, 'Select an end date')}
                    </p>
                  </div>
                </div>
                <div class="border-t border-edge p-3">
                  <div class="grid grid-cols-2 gap-3">
                    <Show
                      when={!props.startReadOnly}
                      fallback={
                        <div class="text-xs text-ink-muted">
                          <span class="block text-xxs font-medium">Start</span>
                          <span
                            aria-label="Start date and time"
                            class="select-text"
                          >
                            {label(props.start, 'Start date')}
                          </span>
                        </div>
                      }
                    >
                      <div>
                        <EventTimeInput
                          id={`composer-start-time-${fieldId}`}
                          label="Start time"
                          value={startParts().time}
                          onChange={(option) => {
                            if (canStart() && !props.allDay)
                              publishRange(
                                withLocalTime(props.start, option.value),
                                props.end
                              );
                          }}
                          disabled={!canStart() || props.allDay}
                        />
                      </div>
                    </Show>
                    <Show
                      when={!props.endReadOnly}
                      fallback={
                        <div class="text-xs text-ink-muted">
                          <span class="block text-xxs font-medium">End</span>
                          <span
                            aria-label="End date and time"
                            class="select-text"
                          >
                            {label(props.end, 'End date')}
                          </span>
                        </div>
                      }
                    >
                      <div>
                        <EventTimeInput
                          id={`composer-end-time-${fieldId}`}
                          label="End time"
                          value={endParts().time}
                          options={endOptions()}
                          selectedId={endTimeId()}
                          onChange={changeEndTime}
                          disabled={!canEnd() || props.allDay}
                        />
                      </div>
                    </Show>
                  </div>
                  <div class="mt-3">
                    <Show
                      when={!props.allDayReadOnly}
                      fallback={
                        <span class="select-text text-xs text-ink-muted">
                          {props.allDay ? 'All day' : 'Timed event'}
                        </span>
                      }
                    >
                      <ToggleSwitch
                        checked={props.allDay}
                        disabled={!canAllDay()}
                        onChange={(allDay) => {
                          if (!canAllDay()) return;
                          setSelection(undefined);
                          props.onAllDayChange(allDay);
                        }}
                        size="sm"
                        label="All day"
                        labelClass="whitespace-nowrap text-xs text-ink-muted"
                      />
                    </Show>
                  </div>
                </div>
              </div>
            </Popover.Content>
          </Layer>
        </Popover.Portal>
      </Popover>
    </Show>
  );
}
