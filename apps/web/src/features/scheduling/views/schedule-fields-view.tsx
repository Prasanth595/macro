import ArrowLeft from '@phosphor/caret-left.svg';
import ArrowRight from '@phosphor/caret-right.svg';
import Plus from '@phosphor/plus.svg';
import { Button } from '@ui';
import { batch, createSignal, Show } from 'solid-js';
import { getDefaultCalendarTimeFormat } from '../../calendar/utils/time-format';
import {
  AvailabilityCalendar,
  type AvailabilityColumn,
} from '../components/availability-calendar';
import { AvailabilityDateOverrides } from '../components/availability-date-overrides';
import { AvailabilityDayDetails } from '../components/availability-day-details';
import {
  AvailabilityGeneralDetails,
  AvailabilityScheduleTitle,
} from '../components/availability-general-details';
import { AvailabilityMonthPicker } from '../components/availability-month-picker';
import { AvailabilityMonthReview } from '../components/availability-month-review';
import { AvailabilityRangeDetails } from '../components/availability-range-details';
import { AvailabilityRangeEditor } from '../components/availability-range-editor';
import { AvailabilitySelectionDetails } from '../components/availability-selection-details';
import {
  type AvailabilityChange,
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
  formatAvailabilityDate,
  shiftAvailabilityMonth,
} from '../core/availability-month';
import { reportDate } from '../core/insights';
import { type AvailabilitySchedule, WEEKDAYS } from '../core/types';
import { createAvailabilityEditor } from '../primitives/create-availability-editor';
import { createAvailabilityMonthEditor } from '../primitives/create-availability-month-editor';
import { createAvailabilitySelection } from '../primitives/create-availability-selection';

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
  let dateSelection!: ReturnType<typeof createAvailabilitySelection>;
  let stamp!: ReturnType<typeof createAvailabilityMonthEditor>;
  const editor = createAvailabilityEditor({
    schedule: () => props.schedule,
    disabled: () => !!props.disabled,
    onEditingChange: (editing) =>
      props.onEditingChange?.(
        editing || !!stamp?.template() || !!dateSelection?.draft()
      ),
    onChange: props.onChange,
  });
  stamp = createAvailabilityMonthEditor({
    schedule: () => props.schedule,
    disabled: () => !!props.disabled,
    unavailable: editor.displayUnavailableWindows,
    copy: editor.copy,
    onEditingChange: (editing) =>
      props.onEditingChange?.(
        editing || !!editor.selection() || !!dateSelection?.draft()
      ),
  });
  dateSelection = createAvailabilitySelection({
    schedule: () => props.schedule,
    disabled: () => !!props.disabled,
    onChange: props.onChange,
    onEditingChange: (editing) =>
      props.onEditingChange?.(
        editing || !!editor.selection() || !!stamp.template()
      ),
  });
  const hasChanges = () => editor.hasChanges() || dateSelection.hasChanges();
  let selectionAnchor: HTMLElement | undefined;
  const dismissSelection = () => {
    dateSelection.close();
    queueMicrotask(() => {
      if (selectionAnchor?.isConnected)
        selectionAnchor.focus({ preventScroll: true });
    });
  };
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
    dateSelection.close();
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
  };
  const openRange = (
    change: AvailabilityChange,
    anchor: HTMLElement,
    drawn = false,
    date = change.target.kind === 'date' ? change.target.date : monthDate()
  ) => {
    setDrawingMode(change.mode);
    dateSelection.close();
    setSelectedDay(undefined);
    closeRange();
    setSelectedRange({
      change,
      anchor: anchor.closest<HTMLElement>('[data-availability-date]') ?? anchor,
      drawn,
      date,
    });
    if (drawn) {
      editor.open(change);
      queueMicrotask(() =>
        root
          .querySelector<HTMLInputElement>(
            '[aria-label="Availability start time"]'
          )
          ?.focus()
      );
    } else editRange();
  };
  const editRange = () => {
    const selected = selectedRange();
    if (!selected) return;
    const change = selected.change;
    editor.open({
      ...change,
      origin: { mode: change.mode, window: { ...change.window } },
    });
  };
  const updateRange = (
    update: (current: AvailabilityChange) => AvailabilityChange
  ) => {
    editor.updateSelection(update);
    const selection = editor.selection();
    if (selection) setDrawingMode(selection.mode);
  };
  const apply = (replaceConflicts = false) => {
    const draft = editor.selection();
    if (!draft) return;
    editor.apply(replaceConflicts);
    if (editor.selection()) return;
    if (selectedRange()?.drawn) {
      dismissRange();
      return;
    }
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
    if (
      editor.clearRanges(
        [change.target],
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
  const previewForDate = (date: string, overridden: boolean) => {
    const stamped = stamp.dates().includes(date) ? stamp.template() : undefined;
    const change =
      stamped ??
      (selectedRange()?.drawn || editor.hasChanges()
        ? editor.selection()
        : undefined);
    if (!change || (!change.allDay && windowsIssue([change.window]))) return;
    if (
      !stamped &&
      (change.target.kind === 'date'
        ? change.target.date !== date
        : overridden || dateWeekday(date) !== change.target.day)
    )
      return;
    return {
      ...change,
      ...(stamped
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
    toggle: boolean,
    interaction?: 'keyboard'
  ) => {
    if (stamp.template()) {
      stamp.select(dates, toggle);
      return;
    }
    if (hasChanges()) return;
    closeRange();
    setSelectedDay(undefined);
    selectionAnchor =
      anchor.closest<HTMLElement>('[data-availability-date]') ?? anchor;
    dateSelection.select(dates);
    if (interaction === 'keyboard') {
      queueMicrotask(() => {
        const content = root.querySelector<HTMLElement>(
          '[aria-label="Edit selected availability"]'
        );
        const control =
          content?.querySelector<HTMLElement>(
            'input:not([type="hidden"]):not(:disabled)'
          ) ?? content?.querySelector<HTMLElement>('button:not(:disabled)');
        control?.focus();
      });
    }
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
      dateSelection.close();
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
      class="portal-scope @container/availability relative flex min-h-0 min-w-0 flex-1 flex-col pt-6"
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
        } else if (dateSelection.dates().length) {
          cancelCalendarDrag();
          dismissSelection();
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
        class="grid min-h-0 min-w-0 flex-1 auto-rows-max grid-cols-1 gap-8 overflow-y-auto @min-[1000px]/availability:grid-cols-2 @min-[1000px]/availability:grid-rows-[minmax(0,1fr)] @min-[1000px]/availability:overflow-hidden"
      >
        <aside
          aria-label="Schedule details"
          class="@container/availability-details min-h-0 min-w-0 @min-[1000px]/availability:h-full @min-[1000px]/availability:overflow-y-auto @min-[1000px]/availability:overscroll-contain"
        >
          <h2 class="sr-only">Schedule details</h2>
          <div class="mb-6 min-w-0 pt-1 pr-1">
            <AvailabilityScheduleTitle
              name={props.schedule.name}
              disabled={!!props.disabled}
              onChange={(name) =>
                props.onChange((schedule) => ({ ...schedule, name }))
              }
            />
          </div>
          <div class="grid min-w-0 grid-cols-1 gap-8 @min-[520px]/availability-details:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <AvailabilityGeneralDetails
              timeZone={props.schedule.timeZone}
              timeFormat={timeFormat()}
              disabled={!!props.disabled}
              timeZoneDisabled={
                !!props.disabled ||
                !!editor.selection() ||
                !!stamp.template() ||
                !!dateSelection.draft()
              }
              onTimeZoneChange={(timeZone) =>
                props.onChange((schedule) => ({ ...schedule, timeZone }))
              }
              onTimeFormatChange={setTimeFormat}
              onClear={clearAvailability}
            />
            <div
              aria-label="Availability editor"
              role="region"
              class="flex min-w-0 flex-col gap-5"
            >
              <Show
                when={
                  !stamp.template() &&
                  !dateSelection.draft() &&
                  !selectedDay() &&
                  (!selectedRange() || selectedRange()?.drawn)
                }
              >
                <div class="flex flex-col gap-2 text-sm">
                  <h3 class="text-base font-semibold leading-6">
                    Availability
                  </h3>
                  <p class="text-xs leading-relaxed text-ink-muted">
                    Select dates or an existing range on the calendar to edit
                    hours.
                  </p>
                </div>
              </Show>
              <Show
                when={stamp.template()}
                fallback={
                  <Show
                    when={dateSelection.draft()}
                    fallback={
                      <Show
                        keyed
                        when={selectedRange()}
                        fallback={
                          <Show keyed when={selectedDay()}>
                            {(selected) => (
                              <AvailabilityDayDetails
                                target={selected.target}
                                label={
                                  selected.target.kind === 'weekly'
                                    ? WEEKDAYS[selected.target.day]
                                    : formatAvailabilityDate(selected.date)
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
                                  openRange(
                                    change,
                                    anchor,
                                    drawn,
                                    selected.date
                                  )
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
                            <Show
                              when={!selected.drawn}
                              fallback={
                                <Show when={editor.selection()}>
                                  {(draft) => (
                                    <AvailabilityRangeEditor
                                      change={draft()}
                                      date={selectedDate()}
                                      timeFormat={timeFormat()}
                                      issue={editor.issue()}
                                      disabled={!!props.disabled}
                                      onChange={updateRange}
                                      onApply={apply}
                                      onClose={dismissRange}
                                      onClear={clearSelectedHours}
                                    />
                                  )}
                                </Show>
                              }
                            >
                              <AvailabilityRangeDetails
                                change={change()}
                                timeZone={props.schedule.timeZone}
                                timeFormat={timeFormat()}
                                date={selectedDate()}
                                inherited={selectedColumn()?.inherited ?? false}
                                overridden={
                                  selectedColumn()?.overridden ?? false
                                }
                                disabled={!!props.disabled}
                                draft={editor.selection()}
                                hasChanges={editor.hasChanges()}
                                issue={editor.issue()}
                                onEdit={editRange}
                                onChange={updateRange}
                                onApply={apply}
                                onClose={dismissRange}
                                onCancelEdit={dismissRange}
                                onRemove={removeAction(change())}
                                onClear={clearSelectedHours}
                                onRestore={restoreAction(change())}
                                onStamp={() => {
                                  const template = change();
                                  closeRange();
                                  stamp.begin(template);
                                }}
                              />
                            </Show>
                          );
                        }}
                      </Show>
                    }
                  >
                    {(draft) => (
                      <AvailabilitySelectionDetails
                        dates={dateSelection.dates()}
                        draft={draft()}
                        issue={dateSelection.issue()}
                        disabled={!!props.disabled}
                        hasChanges={dateSelection.hasChanges()}
                        onEdit={dateSelection.edit}
                        onChange={dateSelection.update}
                        onApply={() => {
                          if (dateSelection.apply()) dismissSelection();
                        }}
                        onClearHours={() => {
                          if (dateSelection.clear()) dismissSelection();
                        }}
                        onClose={dismissSelection}
                      />
                    )}
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
              <Button
                variant="ghost"
                size="sm"
                class="self-start"
                disabled={
                  !!props.disabled ||
                  hasChanges() ||
                  !!selectedRange()?.drawn ||
                  !!stamp.template()
                }
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
                <Plus class="size-5" />
                Add availability
              </Button>
            </div>
          </div>
        </aside>
        <section
          aria-label="Availability calendar and overrides"
          class="flex min-h-0 min-w-0 w-full max-w-[48rem] flex-col justify-self-end @min-[1000px]/availability:h-full @min-[1000px]/availability:overflow-y-auto @min-[1000px]/availability:overscroll-contain"
        >
          <div class="flex min-h-0 min-w-0 shrink-0 flex-col @min-[1000px]/availability:max-h-full">
            <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-3">
              <div class="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  label="Previous month"
                  disabled={!!props.disabled || hasChanges()}
                  onClick={() => {
                    closeRange();
                    dateSelection.close();
                    setSelectedDay(undefined);
                    setMonthDate(shiftAvailabilityMonth(monthDate(), -1));
                  }}
                >
                  <ArrowLeft class="size-4" />
                </Button>
                <AvailabilityMonthPicker
                  date={monthDate()}
                  disabled={!!props.disabled || hasChanges()}
                  onChange={(date) => {
                    closeRange();
                    dateSelection.close();
                    setSelectedDay(undefined);
                    setMonthDate(date);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  label="Next month"
                  disabled={!!props.disabled || hasChanges()}
                  onClick={() => {
                    closeRange();
                    dateSelection.close();
                    setSelectedDay(undefined);
                    setMonthDate(shiftAvailabilityMonth(monthDate(), 1));
                  }}
                >
                  <ArrowRight class="size-4" />
                </Button>
              </div>
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
                disabled={!!props.disabled || hasChanges()}
                stamping={!!stamp.template()}
                getBoundary={() => viewport}
                selectedDates={
                  stamp.template()
                    ? stamp.dates()
                    : dateSelection.dates().length
                      ? dateSelection.dates()
                      : selectedRange()
                        ? [selectedDate()]
                        : []
                }
                selectionPreview={stamp.template()}
                onCancelReady={(cancel) => {
                  cancelCalendarDrag = cancel;
                }}
                onCancelSelection={() => {
                  if (stamp.template()) stamp.exit();
                  else if (dateSelection.dates().length) dismissSelection();
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
                Click or drag to edit dates · select an item to edit its hours
              </span>
            </div>
            <Show when={editor.notice()}>
              <p role="status" class="mt-3 shrink-0 text-xs text-ink-muted">
                {editor.notice()}
              </p>
            </Show>
            <Show when={dateSelection.notice()}>
              <p role="status" class="mt-3 shrink-0 text-xs text-ink-muted">
                {dateSelection.notice()}
              </p>
            </Show>
          </div>
          <div class="mt-6 min-w-0 shrink-0 pb-4">
            <AvailabilityDateOverrides
              overrides={props.schedule.overrides}
              disabled={!!props.disabled || hasChanges()}
              onSelect={selectOverride}
              onRemove={(date) => {
                if (selectedRange() && selectedDate() === date) dismissRange();
                if (selectedDay()?.date === date) dismissDay();
                if (dateSelection.draft()?.dates.includes(date))
                  dateSelection.close();
                editor.restoreDate(date);
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
