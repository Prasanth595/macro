import ArrowLeft from '@phosphor/caret-left.svg';
import ArrowRight from '@phosphor/caret-right.svg';
import Plus from '@phosphor/plus.svg';
import X from '@phosphor/x.svg';
import { Button, Tabs } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import {
  AvailabilityCalendar,
  type AvailabilityColumn,
} from '../components/availability-calendar';
import { AvailabilityMonthPicker } from '../components/availability-month-picker';
import { AvailabilityMonthReview } from '../components/availability-month-review';
import { AvailabilityRangePopover } from '../components/availability-range-popover';
import { AvailabilityTypePicker } from '../components/availability-type-picker';
import { Field, TimeZoneInput } from '../components/fields';
import {
  type AvailabilityChange,
  type AvailabilityIssue,
  dateWeekday,
  targetWindows,
  validAvailabilityDate,
  windowsIssue,
} from '../core/availability';
import {
  type AvailabilityTimeFormat,
  availabilityMonth,
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
  const [timeFormat, setTimeFormat] =
    createSignal<AvailabilityTimeFormat>('24h');
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
  let boundary!: HTMLDivElement;
  let cancelCalendarDrag = () => {};
  let addTrigger!: HTMLButtonElement;
  const [drawingMode, setDrawingMode] =
    createSignal<AvailabilityChange['mode']>('available');
  const drawingPreview = () => ({
    mode: drawingMode(),
    window: { start: '09:00', end: '17:00' },
  });
  const [popover, setPopover] = createSignal<{
    change: AvailabilityChange;
    anchor: HTMLElement;
    drawn: boolean;
    date: string;
  }>();
  const closePopover = () => {
    editor.close();
    setPopover(undefined);
    setBatchDates([]);
    setBatchIssue(undefined);
  };
  const openPopover = (
    change: AvailabilityChange,
    anchor: HTMLElement,
    drawn = false,
    date = change.target.kind === 'date' ? change.target.date : monthDate()
  ) => {
    setDrawingMode(change.mode);
    closePopover();
    setPopover({
      change,
      anchor: anchor.closest<HTMLElement>('[data-availability-date]') ?? anchor,
      drawn,
      date,
    });
    if (drawn) editor.open(change);
  };
  const editPopover = () => {
    const selected = popover();
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
      else closePopover();
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
    setPopover(
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
  const anchorRect = () => popover()?.anchor.getBoundingClientRect();
  // Capture the range before the popover closes and disposes its selection.
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
      : (popover()?.date ?? monthDate());
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
    const change = stamped ?? editor.selection();
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
    openPopover(
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
  return (
    <div
      ref={boundary}
      class="portal-scope @container relative flex min-h-0 min-w-0 flex-1 flex-col gap-3"
      onKeyDown={(event) => {
        if (
          event.key !== 'Escape' ||
          event.defaultPrevented ||
          !stamp.template()
        )
          return;
        cancelCalendarDrag();
        stamp.exit();
        event.preventDefault();
      }}
    >
      <section class="flex min-h-0 min-w-0 w-full flex-1 flex-col">
        <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-3">
          <div class="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon-sm"
              label="Previous month"
              disabled={props.disabled}
              onClick={() => {
                closePopover();
                setMonthDate(shiftAvailabilityMonth(monthDate(), -1));
              }}
            >
              <ArrowLeft class="size-4" />
            </Button>
            <AvailabilityMonthPicker
              date={monthDate()}
              disabled={props.disabled}
              onChange={(date) => {
                closePopover();
                setMonthDate(date);
              }}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              label="Next month"
              disabled={props.disabled}
              onClick={() => {
                closePopover();
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
          <Field label="Time zone" class="w-48 max-w-full gap-1 text-xs">
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
          <AvailabilityTypePicker
            label="Availability drawing type"
            mode={drawingMode()}
            disabled={props.disabled || !!popover() || !!stamp.template()}
            onChange={setDrawingMode}
          />
          <Button
            ref={addTrigger}
            variant="ghost"
            size="sm"
            disabled={props.disabled || !!stamp.template()}
            onClick={(event) => {
              if (popover()) return;
              openPopover(
                {
                  target: { kind: 'date', date: monthDate() },
                  mode: drawingMode(),
                  window: { start: '09:00', end: '17:00' },
                },
                event.currentTarget,
                true
              );
            }}
          >
            <Plus class="size-3.5" />
            Add availability
          </Button>
        </div>
        <Show when={invalidDays().length}>
          <div
            role="alert"
            class="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-failure-bg p-3 text-xs text-failure"
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
        <Show when={stamp.template()}>
          {(template) => (
            <div class="my-3">
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
            </div>
          )}
        </Show>
        <Show when={editor.actionError()}>
          <p role="alert" class="mt-3 text-xs text-failure">
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
            disabled={!!props.disabled || !!editor.selection()}
            popoverOpen={!!popover()}
            stamping={!!stamp.template()}
            selectedDates={stamp.template() ? stamp.dates() : batchDates()}
            selectionPreview={
              stamp.template() ?? editor.selection() ?? drawingPreview()
            }
            onDismissPopover={closePopover}
            onCancelReady={(cancel) => {
              cancelCalendarDrag = cancel;
            }}
            onCancelSelection={() => {
              if (stamp.template()) stamp.exit();
              else closePopover();
            }}
            onDates={selectDates}
            onSelect={(change, anchor, date) =>
              openPopover(change, anchor, false, date)
            }
            onToggle={editor.toggle}
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
            Click a day to add · drag across days · select an item to apply
            elsewhere
          </span>
        </div>
        <Show when={editor.notice()}>
          <p role="status" class="mt-3 text-xs text-ink-muted">
            {editor.notice()}
          </p>
        </Show>
      </section>
      <Show when={props.schedule.overrides.length}>
        <section
          aria-label="Saved date overrides"
          class="max-h-24 shrink-0 overflow-y-auto border-b border-edge-muted pb-3"
        >
          <h4 class="mb-3 text-xs font-semibold">
            Date overrides in this schedule
          </h4>
          <div class="flex flex-wrap gap-2">
            <For
              each={[...props.schedule.overrides].sort((a, b) =>
                a.date.localeCompare(b.date)
              )}
            >
              {(override) => (
                <div class="flex items-center rounded-md border border-edge-muted text-xs">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      props.disabled || !validAvailabilityDate(override.date)
                    }
                    onClick={() => {
                      closePopover();
                      setMonthDate(override.date);
                    }}
                  >
                    {override.date || 'Choose a date'} ·{' '}
                    {override.windows.length
                      ? `${override.windows.length} ${override.windows.length === 1 ? 'range' : 'ranges'}`
                      : 'Unavailable'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    label={`Remove override ${override.date}`}
                    disabled={props.disabled}
                    onClick={() => editor.restoreDate(override.date)}
                  >
                    <X class="size-3" />
                  </Button>
                </div>
              )}
            </For>
          </div>
        </section>
      </Show>
      <Show keyed when={popover()?.anchor}>
        {(anchor) => {
          const initial = popover()!.change;
          const change = () => popover()?.change ?? initial;
          return (
            <AvailabilityRangePopover
              anchor={anchor}
              addTrigger={addTrigger}
              getAnchorRect={anchorRect}
              boundary={boundary}
              change={change()}
              timeZone={props.schedule.timeZone}
              timeFormat={timeFormat()}
              date={selectedDate()}
              dates={batchDates()}
              inherited={selectedColumn()?.inherited ?? false}
              overridden={selectedColumn()?.overridden ?? false}
              inactive={
                change().target.kind === 'weekly' &&
                !selectedColumn()?.weeklyEnabled
              }
              disabled={!!props.disabled}
              draft={editor.selection()}
              issue={rangeIssue()}
              onEdit={editPopover}
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
              onClose={closePopover}
              onCancelEdit={() => {
                if (popover()?.drawn) closePopover();
                else editor.close();
              }}
              onRemove={removeAction(change())}
              onRestore={restoreAction(change())}
              onStamp={() => {
                const template = change();
                closePopover();
                stamp.begin(template);
              }}
            />
          );
        }}
      </Show>
    </div>
  );
}
