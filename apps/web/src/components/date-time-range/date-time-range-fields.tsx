import { ScopedPortal } from '@core/component/ScopedPortal';
import { formatLocalDate, parseLocalDate } from '@core/util/local-date';
import { Popover } from '@kobalte/core/popover';
import { Calendar } from '@ui/components/Calendar';
import { Layer } from '@ui/components/Layer';
import { ToggleSwitch } from '@ui/components/ToggleSwitch';
import { cn } from '@ui/utils/classname';
import { createSignal, createUniqueId } from 'solid-js';
import { dateLabelFormatter, TimeInput } from './time-input';
import {
  DAY_TIME_OPTIONS,
  dayOffsetBetween,
  endTimeOptions,
  endValueFor,
  formatTimeValue,
  selectedTimeOptionId,
  splitLocalDateTime,
  type TimeOption,
  withinEndTimeWindow,
  withLocalDate,
  withLocalTime,
} from './time-options';

interface DateTimeDropdownProps {
  id: string;
  triggerId?: string;
  subject: string;
  label: 'Start' | 'End';
  value: string;
  allDay: boolean;
  /**
   * Range start the offered times are measured from, present on the end
   * field: its options carry the duration they produce and roll into the
   * following day past midnight.
   */
  anchorStart?: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  fieldDisabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  placement: 'bottom-start' | 'bottom-end';
}

function DateTimeDropdown(props: DateTimeDropdownProps) {
  const [open, setOpen] = createSignal(false);
  const parts = () => splitLocalDateTime(props.value);
  const selectedDate = () => parseLocalDate(parts().date);
  const label = () => {
    const date = selectedDate();
    const dateLabel = date
      ? dateLabelFormatter.format(date)
      : `${props.label} date`;
    if (props.allDay) return dateLabel;
    return `${dateLabel} ${formatTimeValue(parts().time) ?? 'Time'}`;
  };
  const anchor = () => {
    const start = props.anchorStart;
    if (!start || !withinEndTimeWindow(start, props.value)) return undefined;
    return start;
  };
  const timeOptions = () => {
    const start = anchor();
    return start
      ? endTimeOptions(splitLocalDateTime(start).time)
      : DAY_TIME_OPTIONS;
  };
  const selectedTimeId = () => {
    const start = anchor();
    return selectedTimeOptionId(
      parts().time,
      start ? dayOffsetBetween(start, props.value) : 0
    );
  };
  const changeTime = (option: TimeOption) => {
    const start = anchor();
    props.onTimeChange(
      start
        ? endValueFor(start, option)
        : withLocalTime(props.value, option.value)
    );
  };

  return (
    <Popover
      open={open() && !props.fieldDisabled}
      onOpenChange={(nextOpen) => setOpen(!props.fieldDisabled && nextOpen)}
      placement={props.placement}
      gutter={4}
      flip
      slide
    >
      <Popover.Trigger
        id={props.triggerId}
        disabled={props.fieldDisabled}
        aria-label={`Edit ${props.subject} ${props.label.toLowerCase()} date and time`}
        aria-invalid={props.invalid || undefined}
        aria-describedby={props.describedBy}
        class={cn(
          'group inline-flex h-7 w-fit max-w-48 min-w-0 items-center justify-between gap-1.5 rounded-lg border border-edge-muted bg-control px-2 py-1 text-left text-xs leading-tight text-ink-muted hover:bg-hover hover:text-ink focus-visible:bg-active focus-visible:text-ink focus-visible:ring-accent/10 data-expanded:bg-hover data-expanded:text-ink disabled:pointer-events-none disabled:opacity-50',
          open() && 'bg-hover text-ink',
          props.invalid &&
            'border-failure text-failure hover:text-failure focus-visible:text-failure data-expanded:text-failure'
        )}
      >
        <CalendarBlankIcon
          class={cn(
            'size-3.5 shrink-0',
            props.invalid
              ? 'text-failure'
              : 'text-ink-extra-muted group-hover:text-ink-muted group-focus-visible:text-ink-muted'
          )}
        />
        <span class="min-w-0 flex-1 truncate">{label()}</span>
        <CaretDownIcon
          class={cn(
            'size-3 shrink-0',
            props.invalid
              ? 'text-failure'
              : 'text-ink-extra-muted group-hover:text-ink-muted group-focus-visible:text-ink-muted'
          )}
        />
      </Popover.Trigger>

      <ScopedPortal scope="local">
        <Layer depth={3}>
          <Popover.Content
            class="menu-surface portal-scope z-action-menu w-72 max-w-[calc(100vw-1rem)] menu-open-animation"
            on:keydown={(event: KeyboardEvent) => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <Popover.Title class="px-3 pt-3 text-xs font-medium text-ink">
              {props.label} {props.allDay ? 'date' : 'date and time'}
            </Popover.Title>
            <div class="p-3">
              <Calendar
                required
                fixedWeeks
                value={selectedDate()}
                onValueChange={(date) => {
                  if (!date || props.fieldDisabled) return;
                  props.onDateChange(formatLocalDate(date));
                }}
              />
            </div>

            <div class="border-t border-edge p-3">
              <div class={cn(props.allDay && 'opacity-50')}>
                <TimeInput
                  id={props.id}
                  label={`${props.label} time`}
                  value={parts().time}
                  options={timeOptions()}
                  selectedId={selectedTimeId()}
                  onChange={changeTime}
                  disabled={props.fieldDisabled || props.allDay}
                />
              </div>
            </div>
          </Popover.Content>
        </Layer>
      </ScopedPortal>
    </Popover>
  );
}

export interface DateTimeRangeFieldsProps {
  /** What the range belongs to, named in the fields' labels: `event`, a column's name. */
  subject: string;
  /** The start field's id, for a label to name or a caller to focus. */
  id?: string;
  /** `YYYY-MM-DD` when all day, else local `YYYY-MM-DDTHH:mm`; empty when unset. */
  start: string;
  end: string;
  allDay: boolean;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onAllDayChange: (allDay: boolean) => void;
  startDisabled?: boolean;
  endDisabled?: boolean;
  allDayDisabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * Separate start/end date-time dropdowns joined by a directional arrow, and an
 * All day switch, as Google Calendar edits an event's time. An all-day end is
 * the last day, included.
 */
export function DateTimeRangeFields(props: DateTimeRangeFieldsProps) {
  const fieldId = createUniqueId();

  return (
    <div class="flex w-full items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <DateTimeDropdown
          id={`range-start-time-${fieldId}`}
          triggerId={props.id}
          subject={props.subject}
          label="Start"
          value={props.start}
          allDay={props.allDay}
          onDateChange={(date) =>
            props.onStartChange(
              props.allDay ? date : withLocalDate(props.start, date)
            )
          }
          onTimeChange={props.onStartChange}
          fieldDisabled={props.startDisabled}
          invalid={props.invalid}
          describedBy={props.describedBy}
          placement="bottom-start"
        />
        <ArrowRightIcon
          aria-hidden={false}
          aria-label="to"
          class={cn(
            'size-3.5 shrink-0 text-ink-extra-muted',
            props.invalid && 'text-failure'
          )}
        />
        <DateTimeDropdown
          id={`range-end-time-${fieldId}`}
          subject={props.subject}
          label="End"
          value={props.end}
          allDay={props.allDay}
          anchorStart={props.allDay ? undefined : props.start}
          onDateChange={(date) =>
            props.onEndChange(
              props.allDay ? date : withLocalDate(props.end, date)
            )
          }
          onTimeChange={props.onEndChange}
          fieldDisabled={props.endDisabled}
          invalid={props.invalid}
          describedBy={props.describedBy}
          placement="bottom-end"
        />
      </div>
      <ToggleSwitch
        checked={props.allDay}
        disabled={props.allDayDisabled}
        onChange={props.onAllDayChange}
        size="sm"
        label="All day"
        labelClass="whitespace-nowrap text-xs text-ink-muted"
        class="shrink-0"
      />
    </div>
  );
}
