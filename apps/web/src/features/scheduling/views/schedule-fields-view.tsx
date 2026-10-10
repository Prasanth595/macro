import ArrowLeft from '@phosphor/caret-left.svg';
import ArrowRight from '@phosphor/caret-right.svg';
import Plus from '@phosphor/plus.svg';
import X from '@phosphor/x.svg';
import { Button } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import {
  AvailabilityCalendar,
  type AvailabilityColumn,
} from '../components/availability-calendar';
import { OverlapHatch } from '../components/availability-overlap-pattern';
import { AvailabilityRangePopover } from '../components/availability-range-popover';
import { AvailabilityTypePicker } from '../components/availability-type-picker';
import { AvailabilityWeekPicker } from '../components/availability-week-picker';
import { Field, TimeZoneInput } from '../components/fields';
import {
  type AvailabilityChange,
  availabilityWeek,
  dateWeekday,
  targetWindows,
  timeMinutes,
  validAvailabilityDate,
  windowsIssue,
} from '../core/availability';
import { reportDate, shiftReportDate } from '../core/insights';
import { type AvailabilitySchedule, WEEKDAYS } from '../core/types';
import { createAvailabilityEditor } from '../primitives/create-availability-editor';

/** Shared availability controls used by settings and AI review. */
export function ScheduleFields(props: {
  schedule: AvailabilitySchedule;
  disabled?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onChange: (
    update: (current: AvailabilitySchedule) => AvailabilitySchedule
  ) => void;
}) {
  const [weekDate, setWeekDate] = createSignal(
    reportDate(new Date(), props.schedule.timeZone)
  );
  const editor = createAvailabilityEditor({
    schedule: () => props.schedule,
    disabled: () => !!props.disabled,
    onEditingChange: props.onEditingChange,
    onChange: props.onChange,
  });
  let boundary!: HTMLDivElement;
  let addTrigger!: HTMLButtonElement;
  const [drawingMode, setDrawingMode] =
    createSignal<AvailabilityChange['mode']>('available');
  const [popover, setPopover] = createSignal<{
    change: AvailabilityChange;
    anchor: HTMLElement;
    drawn: boolean;
  }>();
  const closePopover = () => {
    editor.close();
    setPopover(undefined);
  };
  const openPopover = (
    change: AvailabilityChange,
    anchor: HTMLElement,
    drawn = false
  ) => {
    setDrawingMode(change.mode);
    closePopover();
    setPopover({ change, anchor, drawn });
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
  const anchorRect = () => {
    const current = popover();
    if (!current) return;
    const day = current.anchor.closest<HTMLElement>('[data-availability-day]');
    if (!day) return current.anchor.getBoundingClientRect();
    const rect = day.getBoundingClientRect();
    const window = current.change.allDay
      ? { start: '00:00', end: '24:00' }
      : current.change.window;
    return {
      x: rect.x,
      y: rect.y + (timeMinutes(window.start) / 1440) * rect.height,
      width: rect.width,
      height:
        ((timeMinutes(window.end) - timeMinutes(window.start)) / 1440) *
        rect.height,
    };
  };
  // Capture the range before the popover closes and disposes its selection.
  const removeAction = (change: AvailabilityChange) => () => {
    if (change.index !== undefined) editor.remove(change.target, change.index);
  };
  const restoreAction = (change: AvailabilityChange) => () => {
    if (change.target.kind === 'date') editor.restoreDate(change.target.date);
  };
  const selectedColumn = () =>
    columns().find((column) => {
      const target = popover()?.change.target;
      return (
        column.target.kind === 'date' &&
        (target?.kind === 'weekly'
          ? target.day === dateWeekday(column.target.date)
          : target?.date === column.target.date)
      );
    });
  const selectedDate = () => {
    const target = editor.selection()?.target ?? popover()?.change.target;
    return target?.kind === 'date'
      ? target.date
      : (dates().find((date) => dateWeekday(date) === target?.day) ??
          weekDate());
  };
  const dates = () => availabilityWeek(weekDate());
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
    >
      <section class="flex min-h-0 min-w-0 flex-1 flex-col">
        <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-3">
          <div class="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon-sm"
              label="Previous availability week"
              disabled={props.disabled}
              onClick={() => {
                closePopover();
                setWeekDate(shiftReportDate(weekDate(), -7));
              }}
            >
              <ArrowLeft class="size-4" />
            </Button>
            <AvailabilityWeekPicker
              date={weekDate()}
              disabled={props.disabled}
              onChange={(date) => {
                closePopover();
                setWeekDate(date);
              }}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              label="Next availability week"
              disabled={props.disabled}
              onClick={() => {
                closePopover();
                setWeekDate(shiftReportDate(weekDate(), 7));
              }}
            >
              <ArrowRight class="size-4" />
            </Button>
          </div>
          <Field label="Time zone" class="w-56 max-w-full gap-1 text-xs">
            <TimeZoneInput
              disabled={props.disabled || !!editor.selection()}
              value={props.schedule.timeZone}
              onChange={(timeZone) =>
                props.onChange((schedule) => ({ ...schedule, timeZone }))
              }
            />
          </Field>
          <AvailabilityTypePicker
            label="Availability drawing type"
            mode={drawingMode()}
            disabled={props.disabled || !!popover()}
            onChange={setDrawingMode}
          />
          <Button
            ref={addTrigger}
            variant="ghost"
            size="sm"
            disabled={props.disabled}
            onClick={(event) => {
              if (popover()) return;
              openPopover(
                {
                  target: { kind: 'date', date: weekDate() },
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
        <Show when={editor.actionError()}>
          <p role="alert" class="mt-3 text-xs text-failure">
            {editor.actionError()}
          </p>
        </Show>
        <div class="flex min-h-0 flex-1 flex-col border-y border-edge-muted">
          <AvailabilityCalendar
            columns={columns()}
            disabled={!!props.disabled || !!editor.selection()}
            popoverOpen={!!popover()}
            onDismissPopover={closePopover}
            draft={editor.selection()}
            selected={popover()?.change}
            mode={drawingMode()}
            onDraw={(change, anchor) => openPopover(change, anchor, true)}
            onSelect={openPopover}
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
          <span class="flex items-center gap-1.5 text-failure">
            <OverlapHatch class="size-3 rounded-sm border border-failure bg-panel" />
            Overlapping hours
          </span>
          <span class="ml-auto">
            Drag empty space to add · drag bars to move · click to edit
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
                      setWeekDate(override.date);
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
              date={selectedDate()}
              inherited={selectedColumn()?.inherited ?? false}
              overridden={selectedColumn()?.overridden ?? false}
              inactive={
                change().target.kind === 'weekly' &&
                !selectedColumn()?.weeklyEnabled
              }
              disabled={!!props.disabled}
              draft={editor.selection()}
              issue={editor.issue()}
              onEdit={editPopover}
              onChange={(update) => {
                editor.updateSelection(update);
                const selection = editor.selection();
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
              onCopy={(targets, merge) => editor.copy(change(), targets, merge)}
            />
          );
        }}
      </Show>
    </div>
  );
}
