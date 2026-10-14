import ArrowLeft from '@phosphor/caret-left.svg';
import ArrowRight from '@phosphor/caret-right.svg';
import Plus from '@phosphor/plus.svg';
import Trash from '@phosphor/trash.svg';
import { Button, Tabs } from '@ui';
import { batch, createSignal, Show } from 'solid-js';
import { getDefaultCalendarTimeFormat } from '../../calendar/utils/time-format';
import {
  AvailabilityCalendar,
  type AvailabilityColumn,
} from '../components/availability-calendar';
import { AvailabilityDateOverrides } from '../components/availability-date-overrides';
import { AvailabilityDayDetails } from '../components/availability-day-details';
import { AvailabilityMonthPicker } from '../components/availability-month-picker';
import { AvailabilityMonthReview } from '../components/availability-month-review';
import { AvailabilityRangeDetails } from '../components/availability-range-details';
import { Field, TextInput, TimeZoneInput } from '../components/fields';
import {
  type AvailabilityChange,
  type AvailabilityIssue,
  type AvailabilityTarget,
  availabilityState,
  dateWeekday,
  targetUnavailableWindows,
  targetWindows,
  windowsIssue,
} from '../core/availability';
import {
  type AvailabilityTimeFormat,
  availabilityMonth,
  formatAvailabilityDateRanges,
  shiftAvailabilityMonth,
} from '../core/availability-month';
import { reportDate } from '../core/insights';
import { type AvailabilitySchedule, WEEKDAYS } from '../core/types';
import { createAvailabilityEditor } from '../primitives/create-availability-editor';
import { createAvailabilityMonthEditor } from '../primitives/create-availability-month-editor';

/** Shared availability controls used by settings and AI review. */
export function ScheduleFields(props: {
  schedule: AvailabilitySchedule;
  disabled?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onChange: (
    update: (current: AvailabilitySchedule) => AvailabilitySchedule
  ) => void;
}) {
  const [monthDate, setMonthDate] = createSignal(
    reportDate(new Date(), props.schedule.timeZone)
  );
  const [timeFormat, setTimeFormat] = createSignal<AvailabilityTimeFormat>(
    getDefaultCalendarTimeFormat() === '24-hour' ? '24h' : '12h'
  );
  const [batchDates, setBatchDates] = createSignal<string[]>([]);
  const [batchIssue, setBatchIssue] = createSignal<AvailabilityIssue>();
  let stamp!: ReturnType<typeof createAvailabilityMonthEditor>;
  const editor = createAvailabilityEditor({
    schedule: () => props.schedule,
    disabled: () => !!props.disabled,
    onEditingChange: (editing) =>
      props.onEditingChange?.(editing || !!stamp?.template()),
    onChange: props.onChange,
  });
  stamp = createAvailabilityMonthEditor({
    schedule: () => props.schedule,
    disabled: () => !!props.disabled,
    unavailable: editor.displayUnavailableWindows,
    copy: editor.copy,
    onEditingChange: (editing) =>
      props.onEditingChange?.(editing || !!editor.selection()),
  });
  let root!: HTMLDivElement;
  let viewport!: HTMLDivElement;
  let cancelCalendarDrag = () => {};
  const [drawingMode, setDrawingMode] =
    createSignal<AvailabilityChange['mode']>('available');
  const drawingPreview = () => ({
    mode: drawingMode(),
    window: { start: '09:00', end: '17:00' },
  });
  const [selectedRange, setSelectedRange] = createSignal<{
    change: AvailabilityChange;
    anchor: HTMLElement;
    drawn: boolean;
    date: string;
  }>();
  const [selectedDay, setSelectedDay] = createSignal<{
    target: AvailabilityTarget;
    date: string;
    anchor: HTMLElement;
  }>();
  const selectedWeekday = () => {
    const target = selectedDay()?.target ?? selectedRange()?.change.target;
    return target?.kind === 'weekly' ? target.day : undefined;
  };
  const dismissDay = () => {
    const selected = selectedDay();
    setSelectedDay(undefined);
    queueMicrotask(
      () => selected?.anchor.isConnected && selected.anchor.focus()
    );
  };
  const openDay = (
    target: AvailabilityTarget,
    date: string,
    anchor: HTMLElement
  ) => {
    closeRange();
    setSelectedDay({ target, date, anchor });
    queueMicrotask(() =>
      root
        .querySelector<HTMLButtonElement>(
          '[aria-label="Day availability state"] button[aria-pressed="true"]'
        )
        ?.focus()
    );
  };
  const closeRange = () => {
    editor.close();
    setSelectedRange(undefined);
    setBatchDates([]);
    setBatchIssue(undefined);
  };
  const openRange = (
    change: AvailabilityChange,
    anchor: HTMLElement,
    drawn = false,
    date = change.target.kind === 'date' ? change.target.date : monthDate()
  ) => {
    setDrawingMode(change.mode);
    setSelectedDay(undefined);
    closeRange();
    setSelectedRange({
      change,
      anchor: anchor.closest<HTMLElement>('[data-availability-date]') ?? anchor,
      drawn,
      date,
    });
    if (drawn) editor.open(change);
  };
  const editRange = () => {
    const selected = selectedRange();
    if (!selected) return;
    const change = selected.change;
    editor.open({
      ...change,
      mode:
        change.mode === 'unavailable' && change.allDay
          ? 'available'
          : change.mode,
      origin: { mode: change.mode, window: { ...change.window } },
    });
  };
  const apply = (replaceConflicts = false) => {
    const draft = editor.selection();
    if (!draft) return;
    if (batchDates().length > 1) {
      const result = editor.copy(
        draft,
        batchDates().map((date) => ({ kind: 'date', date })),
        replaceConflicts
      );
      if (!result.ok) setBatchIssue(result.issue);
      else dismissRange();
      return;
    }
    editor.apply(replaceConflicts);
    if (editor.selection()) return;
    const windows = targetWindows(props.schedule, draft.target);
    const savedWindow = draft.allDay
      ? { start: '00:00', end: '23:59' }
      : draft.window;
    const index = windows.findIndex(
      (window) =>
        window.start <= savedWindow.start && window.end >= savedWindow.end
    );
    setSelectedRange(
      (current) =>
        current && {
          ...current,
          drawn: false,
          change:
            draft.mode === 'available' && index >= 0
              ? { ...draft, origin: undefined, window: windows[index], index }
              : {
                  ...draft,
                  origin: undefined,
                  index: undefined,
                  window:
                    draft.target.kind === 'date'
                      ? (editor
                          .displayUnavailableWindows(draft.target.date)
                          .find(
                            (window) =>
                              window.start < savedWindow.end &&
                              window.end > savedWindow.start
                          ) ?? savedWindow)
                      : savedWindow,
                },
        }
    );
  };
  const clearSelectedHours = () => {
    const change = editor.selection() ?? selectedRange()?.change;
    if (!change) return;
    const targets =
      batchDates().length > 1
        ? batchDates().map(
            (date): AvailabilityTarget => ({ kind: 'date', date })
          )
        : [change.target];
    if (
      editor.clearRanges(
        targets,
        change.allDay ? { start: '00:00', end: '23:59' } : change.window
      )
    )
      dismissRange();
  };
  // Capture the selected range before closing its details.
  const removeAction = (change: AvailabilityChange) => () => {
    if (change.index !== undefined) editor.remove(change.target, change.index);
  };
  const restoreAction = (change: AvailabilityChange) => () => {
    if (change.target.kind === 'date') editor.restoreDate(change.target.date);
  };
  const selectedColumn = () =>
    columns().find((column) => column.target.date === selectedDate());
  const selectedDate = () => {
    const target = editor.selection()?.target;
    return target?.kind === 'date'
      ? target.date
      : (selectedRange()?.date ?? monthDate());
  };
  const dates = () => availabilityMonth(monthDate());
  const batchConflicts = () =>
    batchDates().length > 1 && editor.selection()
      ? stamp.conflicts(editor.selection(), batchDates())
      : [];
  const rangeIssue = () => {
    if (batchIssue()) return batchIssue();
    const conflicts = batchConflicts();
    if (!conflicts.length) return editor.issue();
    return {
      message: conflicts
        .map(({ date, issue }) => `${date}: ${issue.message}`)
        .join(' '),
      mergeable: true,
      overlaps: conflicts.flatMap(({ issue }) => issue.overlaps ?? []),
    };
  };
  const previewForDate = (date: string, overridden: boolean) => {
    const stamped = stamp.dates().includes(date) ? stamp.template() : undefined;
    const change =
      stamped ??
      (selectedRange()?.drawn || editor.hasChanges()
        ? editor.selection()
        : undefined);
    if (!change || (!change.allDay && windowsIssue([change.window]))) return;
    const bulk = !!stamped || batchDates().length > 1;
    if (
      bulk
        ? !(stamped || batchDates().includes(date))
        : change.target.kind === 'date'
          ? change.target.date !== date
          : overridden || dateWeekday(date) !== change.target.day
    )
      return;
    return {
      ...change,
      ...(bulk
        ? {
            target: { kind: 'date' as const, date },
            origin: undefined,
            index: undefined,
          }
        : {}),
      window: change.allDay ? { start: '00:00', end: '23:59' } : change.window,
    };
  };
  const selectDates = (
    dates: string[],
    anchor: HTMLElement,
    toggle: boolean
  ) => {
    if (stamp.template()) {
      stamp.select(dates, toggle);
      return;
    }
    openRange(
      {
        target: { kind: 'date', date: dates[0] },
        ...drawingPreview(),
      },
      anchor,
      true
    );
    setBatchDates(dates);
  };
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
  const columns = (): AvailabilityColumn[] =>
    dates().map((date) => {
      const overridden = props.schedule.overrides.some(
        (override) => override.date === date
      );
      const day = dateWeekday(date);
      const weeklyWindows = editor.displayWeeklyWindows(day);
      return {
        target: { kind: 'date', date },
        label: WEEKDAYS[dateWeekday(date)],
        dateLabel: dateLabel(date),
        inherited: !overridden,
        overridden,
        windows: overridden
          ? targetWindows(props.schedule, { kind: 'date', date })
          : weeklyWindows,
        weeklyWindows,
        weeklyEnabled: !!targetWindows(props.schedule, { kind: 'weekly', day })
          .length,
        unavailable: editor.displayUnavailableWindows(date),
        draft: previewForDate(date, overridden),
      };
    });
  const invalidDays = () =>
    [...props.schedule.weekly, ...props.schedule.overrides].filter((day) =>
      windowsIssue(day.windows)
    );
  const hasOverlaps = () =>
    invalidDays().some((day) => windowsIssue(day.windows)?.mergeable);
  const dismissRange = () => {
    const current = selectedRange();
    closeRange();
    if (!current) return;
    queueMicrotask(() => {
      const fallback = Array.from(
        root.querySelectorAll<HTMLElement>('[data-availability-date]')
      ).find((element) => element.dataset.availabilityDate === current.date);
      (current.anchor.isConnected ? current.anchor : fallback)?.focus({
        preventScroll: true,
      });
    });
  };
  const clearAvailability = () => {
    if (props.disabled) return;
    cancelCalendarDrag();
    batch(() => {
      stamp.exit();
      closeRange();
      setSelectedDay(undefined);
      setDrawingMode('available');
      editor.clear();
    });
  };
  const selectOverride = (date: string, anchor: HTMLElement) => {
    const override = props.schedule.overrides.find(
      (override) => override.date === date
    );
    if (!override) return;
    setMonthDate(date);
    if (stamp.template()) return;
    const window = override.windows[0];
    const timeOff = targetUnavailableWindows(props.schedule, {
      kind: 'date',
      date,
    });
    if (!window && !timeOff.length) {
      openDay({ kind: 'date', date }, date, anchor);
      return;
    }
    openRange(
      {
        target: { kind: 'date', date },
        mode: window ? 'available' : 'unavailable',
        window: window ?? timeOff[0],
        index: window ? 0 : undefined,
        allDay:
          (window ?? timeOff[0]).start === '00:00' &&
          (window ?? timeOff[0]).end === '23:59',
      },
      anchor,
      false,
      date
    );
  };

  return (
    <div
      ref={root}
      class="portal-scope @container/availability relative flex min-h-0 min-w-0 flex-1 flex-col"
      onKeyDown={(event) => {
        if (
          event.key !== 'Escape' ||
          event.defaultPrevented ||
          (event.target instanceof Element &&
            event.target.closest(
              '[role="dialog"], [aria-haspopup="dialog"][aria-expanded="true"]'
            ))
        )
          return;
        if (stamp.template()) {
          cancelCalendarDrag();
          stamp.exit();
        } else if (selectedRange()) {
          cancelCalendarDrag();
          dismissRange();
        } else if (selectedDay()) dismissDay();
        else return;
        event.preventDefault();
      }}
    >
      <div
        ref={viewport}
        class="flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-y-auto @min-[1000px]/availability:flex-row @min-[1000px]/availability:overflow-hidden"
      >
        <section class="flex h-[34rem] min-h-0 min-w-0 shrink-0 flex-col @min-[1000px]/availability:h-auto @min-[1000px]/availability:flex-1">
          <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-3">
            <div class="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon-sm"
                label="Previous month"
                disabled={props.disabled}
                onClick={() => {
                  closeRange();
                  setSelectedDay(undefined);
                  setMonthDate(shiftAvailabilityMonth(monthDate(), -1));
                }}
              >
                <ArrowLeft class="size-4" />
              </Button>
              <AvailabilityMonthPicker
                date={monthDate()}
                disabled={props.disabled}
                onChange={(date) => {
                  closeRange();
                  setSelectedDay(undefined);
                  setMonthDate(date);
                }}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                label="Next month"
                disabled={props.disabled}
                onClick={() => {
                  closeRange();
                  setSelectedDay(undefined);
                  setMonthDate(shiftAvailabilityMonth(monthDate(), 1));
                }}
              >
                <ArrowRight class="size-4" />
              </Button>
            </div>
            <Tabs
              aria-label="Time format"
              list={[
                { value: '12h', label: '12h' },
                { value: '24h', label: '24h' },
              ]}
              value={timeFormat()}
              onChange={(value) => {
                if (value === '12h' || value === '24h') setTimeFormat(value);
              }}
            />
          </div>
          <Show when={invalidDays().length}>
            <div
              role="alert"
              class="mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-lg bg-failure-bg p-3 text-xs text-failure"
            >
              <p class="flex-1">
                {invalidDays()
                  .map(
                    (day) =>
                      `${'day' in day ? WEEKDAYS[day.day] : day.date}: ${windowsIssue(day.windows)?.message}`
                  )
                  .join(' ')}
              </p>
              <Show when={hasOverlaps()}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={props.disabled}
                  onClick={editor.fixOverlaps}
                >
                  Merge overlapping hours
                </Button>
              </Show>
            </div>
          </Show>
          <Show when={editor.actionError()}>
            <p role="alert" class="mb-3 shrink-0 text-xs text-failure">
              {editor.actionError()}
            </p>
          </Show>
          <div
            class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-edge-muted bg-panel"
            data-availability-calendar-frame
          >
            <AvailabilityCalendar
              columns={columns()}
              timeFormat={timeFormat()}
              month={monthDate().slice(0, 7)}
              today={reportDate(new Date(), props.schedule.timeZone)}
              disabled={!!props.disabled || editor.hasChanges()}
              stamping={!!stamp.template()}
              getBoundary={() => viewport}
              selectedDates={
                stamp.template()
                  ? stamp.dates()
                  : batchDates().length
                    ? batchDates()
                    : selectedRange()
                      ? [selectedDate()]
                      : []
              }
              selectionPreview={
                stamp.template() ?? editor.selection() ?? drawingPreview()
              }
              onCancelReady={(cancel) => {
                cancelCalendarDrag = cancel;
              }}
              onCancelSelection={() => {
                if (stamp.template()) stamp.exit();
                else if (selectedRange()) dismissRange();
                else dismissDay();
              }}
              onDates={selectDates}
              onSelect={(change, anchor, date) =>
                openRange(change, anchor, false, date)
              }
              weekdayStates={WEEKDAYS.map((_, day) =>
                availabilityState(props.schedule, { kind: 'weekly', day })
              )}
              selectedWeekday={selectedWeekday()}
              onSelectWeekday={(day, anchor) =>
                openDay(
                  { kind: 'weekly', day },
                  dates().find(
                    (date) =>
                      date.startsWith(monthDate().slice(0, 7)) &&
                      dateWeekday(date) === day
                  ) ?? monthDate(),
                  anchor
                )
              }
            />
          </div>
          <div class="mt-3 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-ink-extra-muted">
            <span class="flex items-center gap-1.5">
              <span class="size-2 rounded-sm bg-accent" />
              Available
            </span>
            <span class="flex items-center gap-1.5">
              <span class="size-2 rounded-sm bg-edge" />
              Unavailable
            </span>
            <span class="ml-auto">
              Click a day to add · drag across days · select an item to edit
            </span>
          </div>
          <Show when={editor.notice()}>
            <p role="status" class="mt-3 shrink-0 text-xs text-ink-muted">
              {editor.notice()}
            </p>
          </Show>
        </section>
        <aside
          aria-label="Schedule details"
          class="flex min-h-0 w-full shrink-0 flex-col gap-5 rounded-xl border border-edge-muted bg-surface-1 p-5 @min-[1000px]/availability:w-96 @min-[1000px]/availability:overflow-y-auto @min-[1000px]/availability:overscroll-contain"
        >
          <div class="flex shrink-0 flex-col gap-4">
            <h2 class="text-sm font-semibold">Schedule details</h2>
            <Field label="Name" class="gap-2 text-xs">
              <TextInput
                aria-label="Schedule name"
                class="h-10"
                required
                maxLength={100}
                value={props.schedule.name}
                disabled={props.disabled}
                onInput={(event) =>
                  props.onChange((schedule) => ({
                    ...schedule,
                    name: event.currentTarget.value,
                  }))
                }
              />
            </Field>
            <Field label="Time zone" class="gap-2 text-xs">
              <TimeZoneInput
                disabled={
                  props.disabled || !!editor.selection() || !!stamp.template()
                }
                value={props.schedule.timeZone}
                onChange={(timeZone) =>
                  props.onChange((schedule) => ({ ...schedule, timeZone }))
                }
              />
            </Field>
          </div>
          <Button
            variant="ghost"
            size="sm"
            class="shrink-0 self-start text-failure not-touch:not-disabled:hover:text-failure"
            tooltip="Clear all weekly hours and date overrides from this draft. Save to apply."
            disabled={props.disabled}
            onClick={clearAvailability}
          >
            <Trash class="size-4" />
            Clear availability
          </Button>
          <div class="shrink-0 border-t border-edge-muted pt-5">
            <Show
              when={stamp.template()}
              fallback={
                <Show
                  keyed
                  when={selectedRange()}
                  fallback={
                    <Show
                      keyed
                      when={selectedDay()}
                      fallback={
                        <Button
                          variant="outline"
                          size="sm"
                          class="min-h-10 w-full"
                          disabled={props.disabled}
                          onClick={(event) =>
                            openRange(
                              {
                                target: { kind: 'date', date: monthDate() },
                                ...drawingPreview(),
                              },
                              event.currentTarget,
                              true
                            )
                          }
                        >
                          <Plus class="size-3.5" />
                          Add availability
                        </Button>
                      }
                    >
                      {(selected) => (
                        <AvailabilityDayDetails
                          target={selected.target}
                          label={
                            selected.target.kind === 'weekly'
                              ? WEEKDAYS[selected.target.day]
                              : formatAvailabilityDateRanges([selected.date])
                          }
                          state={availabilityState(
                            props.schedule,
                            selected.target
                          )}
                          windows={targetWindows(
                            props.schedule,
                            selected.target
                          )}
                          unavailable={targetUnavailableWindows(
                            props.schedule,
                            selected.target
                          )}
                          timeFormat={timeFormat()}
                          disabled={!!props.disabled}
                          onStateChange={(state) =>
                            editor.setState(selected.target, state)
                          }
                          onSelect={(change, anchor, drawn) =>
                            openRange(change, anchor, drawn, selected.date)
                          }
                          onClose={dismissDay}
                        />
                      )}
                    </Show>
                  }
                >
                  {(selected) => {
                    const change = () =>
                      selectedRange()?.change ?? selected.change;
                    return (
                      <AvailabilityRangeDetails
                        change={change()}
                        timeZone={props.schedule.timeZone}
                        timeFormat={timeFormat()}
                        date={selectedDate()}
                        dates={batchDates()}
                        inherited={selectedColumn()?.inherited ?? false}
                        overridden={selectedColumn()?.overridden ?? false}
                        disabled={!!props.disabled}
                        draft={editor.selection()}
                        issue={rangeIssue()}
                        onEdit={editRange}
                        onChange={(update) => {
                          editor.updateSelection(update);
                          const selection = editor.selection();
                          setBatchIssue(undefined);
                          if (
                            batchDates().length === 1 &&
                            selection?.target.kind === 'date'
                          )
                            setBatchDates([selection.target.date]);
                          if (selection) setDrawingMode(selection.mode);
                        }}
                        onApply={apply}
                        onClose={dismissRange}
                        onCancelEdit={() => {
                          if (selectedRange()?.drawn) dismissRange();
                          else editor.close();
                        }}
                        onRemove={removeAction(change())}
                        onClear={clearSelectedHours}
                        onRestore={restoreAction(change())}
                        onStamp={() => {
                          const template = change();
                          closeRange();
                          stamp.begin(template);
                        }}
                      />
                    );
                  }}
                </Show>
              }
            >
              {(template) => (
                <AvailabilityMonthReview
                  template={template()}
                  timeFormat={timeFormat()}
                  dates={stamp.dates()}
                  conflicts={stamp.conflicts()}
                  error={stamp.error()}
                  disabled={!!props.disabled}
                  onClear={stamp.clear}
                  onExit={stamp.exit}
                  onApply={stamp.apply}
                />
              )}
            </Show>
          </div>
          <AvailabilityDateOverrides
            overrides={props.schedule.overrides}
            disabled={!!props.disabled || editor.hasChanges()}
            onSelect={selectOverride}
            onRemove={(date) => {
              if (selectedRange() && selectedDate() === date) dismissRange();
              if (selectedDay()?.date === date) dismissDay();
              editor.restoreDate(date);
            }}
          />
        </aside>
      </div>
    </div>
  );
}
