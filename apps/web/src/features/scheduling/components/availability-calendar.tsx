import { createMemo, createSignal, For, Index, onMount, Show } from 'solid-js';
import { createPointerAutoScroll } from '../../../components/drag-drop/create-pointer-auto-scroll';
import {
  type AvailabilityChange,
  type AvailabilityState,
  dateWeekday,
  windowsIssue,
} from '../core/availability';
import { availabilityBars } from '../core/availability-bars';
import {
  type AvailabilityMonthRun,
  type AvailabilityTimeFormat,
  availabilityDateRange,
  availabilityMonthRuns,
  availabilityTimeLabel,
} from '../core/availability-month';
import { type TimeWindow, WEEKDAYS } from '../core/types';
import { AvailabilitySelectionBar } from './availability-selection-bar';

export type AvailabilityColumn = {
  target: { kind: 'date'; date: string };
  label: string;
  dateLabel?: string;
  inherited: boolean;
  overridden: boolean;
  windows: TimeWindow[];
  weeklyWindows: TimeWindow[];
  weeklyEnabled: boolean;
  unavailable: TimeWindow[];
  draft?: AvailabilityChange;
};

export function AvailabilityCalendar(props: {
  columns: AvailabilityColumn[];
  month: string;
  today: string;
  disabled: boolean;
  timeFormat: AvailabilityTimeFormat;
  stamping: boolean;
  selectedDates: string[];
  selectionPreview?: Pick<AvailabilityChange, 'mode' | 'window' | 'allDay'>;
  getBoundary?: () => HTMLElement;
  onCancelSelection: () => void;
  onCancelReady: (cancel: () => void) => void;
  onDates: (
    dates: string[],
    anchor: HTMLElement,
    toggle: boolean,
    interaction?: 'keyboard'
  ) => void;
  onSelect: (
    change: AvailabilityChange,
    anchor: HTMLElement,
    date: string
  ) => void;
  weekdayStates: AvailabilityState[];
  selectedWeekday?: number;
  onSelectWeekday: (day: number, anchor: HTMLElement) => void;
}) {
  const [drag, setDrag] = createSignal<{
    pointerId: number;
    first: string;
    last: string;
    capture: HTMLElement;
  }>();
  const selected = createMemo(() => {
    const current = drag();
    if (!current) return props.selectedDates;
    const dates = availabilityDateRange(current.first, current.last);
    return props.stamping
      ? [...new Set([...props.selectedDates, ...dates])]
      : dates;
  });
  const preview = () => {
    const change = props.selectionPreview;
    if (!change) return;
    if (!drag() && !props.stamping && selected().length < 2) return;
    if (!change.allDay && windowsIssue([change.window])) return;
    return change;
  };
  const previewHours = () => {
    const change = preview();
    return change?.allDay
      ? 'All day'
      : change
        ? availabilityTimeLabel(change.window, props.timeFormat)
        : '';
  };
  const runs = createMemo(() =>
    preview()
      ? availabilityMonthRuns(
          props.columns.map((column) => column.target.date),
          selected()
        )
      : []
  );
  const conflicting = (run: AvailabilityMonthRun) =>
    props.columns
      .slice(run.startIndex, run.startIndex + run.dates.length)
      .some((column) => {
        const change = props.selectionPreview;
        if (!change) return false;
        const bars = availabilityBars(
          column.windows,
          column.unavailable,
          {
            ...change,
            target: column.target,
            window: change.allDay
              ? { start: '00:00', end: '23:59' }
              : change.window,
          },
          column.overridden || column.weeklyEnabled
        );
        return bars[change.mode].some(
          (bar) => bar.draft && bar.overlaps.length
        );
      });
  let scroll!: HTMLDivElement;
  let header!: HTMLDivElement;
  let pointer: { x: number; y: number } | undefined;
  let suppressedClick = false;
  const visibleBounds = () => {
    const bounds = scroll.getBoundingClientRect();
    const boundary = props.getBoundary?.().getBoundingClientRect();
    return {
      left: Math.max(bounds.left, boundary?.left ?? bounds.left),
      right: Math.min(bounds.right, boundary?.right ?? bounds.right),
      top: Math.max(
        header.getBoundingClientRect().bottom,
        boundary?.top ?? bounds.top
      ),
      bottom: Math.min(bounds.bottom, boundary?.bottom ?? bounds.bottom),
    };
  };
  const updateDate = () => {
    const current = drag();
    if (!current || !pointer) return;
    const bounds = visibleBounds();
    const top = Math.max(bounds.top, 0);
    const bottom = Math.min(bounds.bottom, window.innerHeight);
    const left = Math.max(bounds.left, 0);
    const right = Math.min(bounds.right, window.innerWidth);
    if (bottom <= top || right <= left) return;
    const hit = document.elementFromPoint(
      Math.max(left + 1, Math.min(right - 1, pointer.x)),
      Math.max(top + 1, Math.min(bottom - 1, pointer.y))
    );
    const cell = hit?.closest<HTMLElement>('[data-availability-date]');
    const date = cell?.dataset.availabilityDate;
    if (date && scroll.contains(cell) && date !== current.last)
      setDrag({ ...current, last: date });
  };
  const autoScroll = createPointerAutoScroll({
    getViewport: () => scroll,
    getPointer: () => (drag() ? pointer : undefined),
    getBounds: visibleBounds,
    axis: 'both',
    allowOutside: true,
    onScroll: updateDate,
  });
  const outerAutoScroll = createPointerAutoScroll({
    getViewport: () =>
      scroll.scrollHeight <= scroll.clientHeight
        ? props.getBoundary?.()
        : undefined,
    getPointer: () => (drag() ? pointer : undefined),
    getBounds: visibleBounds,
    axis: 'y',
    allowOutside: true,
    onScroll: updateDate,
  });
  const cancel = () => {
    autoScroll.stop();
    outerAutoScroll.stop();
    pointer = undefined;
    const current = drag();
    setDrag(undefined);
    if (current?.capture.hasPointerCapture(current.pointerId))
      current.capture.releasePointerCapture(current.pointerId);
  };
  onMount(() => props.onCancelReady(cancel));
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat('en', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
  return (
    <div
      ref={scroll}
      aria-label="Availability calendar"
      class="min-h-0 w-full flex-1 overflow-auto overscroll-contain bg-panel"
      onScroll={updateDate}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        suppressedClick = true;
        cancel();
        props.onCancelSelection();
        event.preventDefault();
      }}
    >
      <div class="flex min-w-[28rem] flex-col">
        <div
          ref={header}
          class="sticky top-0 z-20 grid h-12 shrink-0 grid-cols-7 border-b border-edge-muted bg-panel"
        >
          <For each={WEEKDAYS}>
            {(label, day) => (
              <button
                type="button"
                class="flex min-w-0 flex-col items-center justify-center gap-0.5 border-r border-edge-muted px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:opacity-50"
                classList={{ 'bg-accent/10': props.selectedWeekday === day() }}
                aria-label={`${label}: ${props.weekdayStates[day()]}. Edit recurring hours`}
                aria-expanded={props.selectedWeekday === day()}
                disabled={props.disabled || props.stamping}
                onClick={(event) =>
                  props.onSelectWeekday(day(), event.currentTarget)
                }
              >
                <span>{label.slice(0, 3)}</span>
                <span
                  class="text-[10px] capitalize"
                  classList={{
                    'text-accent': props.weekdayStates[day()] === 'available',
                    'text-ink-muted':
                      props.weekdayStates[day()] === 'unavailable',
                    'text-ink-extra-muted':
                      props.weekdayStates[day()] === 'unset',
                  }}
                >
                  {props.weekdayStates[day()]}
                </span>
              </button>
            )}
          </For>
        </div>
        <div class="grid aspect-[7/6] min-h-0 grid-cols-7 grid-rows-6">
          <Index each={props.columns}>
            {(column, index) => {
              const date = () => column().target.date;
              const run = () =>
                runs().find((run) => run.dates.includes(date()));
              const tallPreview = () =>
                run()?.dates.length === 1 &&
                props.timeFormat === '12h' &&
                previewHours() !== 'All day';
              const active = () =>
                column().overridden || column().weeklyEnabled;
              const bars = createMemo(() =>
                availabilityBars(
                  column().windows,
                  column().unavailable,
                  run() ? undefined : column().draft,
                  active()
                )
              );
              const coveredByPreview = (
                mode: AvailabilityChange['mode'],
                window: TimeWindow
              ) => {
                const selection = preview();
                return (
                  !!run() &&
                  !!selection &&
                  mode === selection.mode &&
                  (selection.allDay ||
                    (window.start >= selection.window.start &&
                      window.end <= selection.window.end))
                );
              };
              const change = (
                mode: AvailabilityChange['mode'],
                window: TimeWindow,
                index?: number
              ): AvailabilityChange => ({
                target: column().inherited
                  ? { kind: 'weekly', day: dateWeekday(date()) }
                  : column().target,
                mode,
                window,
                index,
                allDay: window.start === '00:00' && window.end === '23:59',
              });
              return (
                <div
                  role="group"
                  aria-label={`${dateLabel(date())}. Click or drag to select dates.`}
                  aria-current={date() === props.today ? 'date' : undefined}
                  data-availability-day
                  data-availability-date={date()}
                  data-selected={
                    selected().includes(date()) ? 'true' : undefined
                  }
                  tabIndex={props.disabled ? undefined : 0}
                  style={{
                    'grid-row': Math.floor(index / 7) + 1,
                    'grid-column': (index % 7) + 1,
                  }}
                  class="flex min-h-0 touch-none select-none flex-col gap-1 overflow-hidden border-r border-b border-edge-muted p-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                  classList={{
                    'bg-surface-1': !date().startsWith(props.month),
                    'bg-accent/10 ring-2 ring-inset ring-accent':
                      selected().includes(date()),
                  }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget || props.disabled)
                      return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      props.onDates(
                        [date()],
                        event.currentTarget,
                        true,
                        'keyboard'
                      );
                    }
                  }}
                  onPointerDown={(event) => {
                    if (event.defaultPrevented) {
                      suppressedClick = true;
                      return;
                    }
                    if (props.disabled || drag() || event.button !== 0) return;
                    if (
                      !props.stamping &&
                      (event.target as Element).closest(
                        '[data-availability-item]'
                      )
                    )
                      return;
                    suppressedClick = false;
                    event.preventDefault();
                    event.currentTarget.focus({ preventScroll: true });
                    event.currentTarget.setPointerCapture(event.pointerId);
                    pointer = { x: event.clientX, y: event.clientY };
                    setDrag({
                      pointerId: event.pointerId,
                      first: date(),
                      last: date(),
                      capture: event.currentTarget,
                    });
                  }}
                  onPointerMove={(event) => {
                    if (drag()?.pointerId !== event.pointerId) return;
                    pointer = { x: event.clientX, y: event.clientY };
                    updateDate();
                    autoScroll.start();
                    outerAutoScroll.start();
                  }}
                  onPointerUp={(event) => {
                    const current = drag();
                    if (!current || current.pointerId !== event.pointerId)
                      return;
                    pointer = { x: event.clientX, y: event.clientY };
                    updateDate();
                    const dates = availabilityDateRange(
                      current.first,
                      drag()?.last ?? current.last
                    );
                    suppressedClick = true;
                    cancel();
                    event.preventDefault();
                    if (dates.length)
                      props.onDates(
                        dates,
                        event.currentTarget,
                        dates.length === 1
                      );
                  }}
                  onPointerCancel={(event) => {
                    if (drag()?.pointerId === event.pointerId) cancel();
                  }}
                  onLostPointerCapture={(event) => {
                    if (drag()?.pointerId === event.pointerId) cancel();
                  }}
                >
                  <div class="flex shrink-0 flex-wrap items-center justify-between gap-1 text-xs">
                    <span
                      class="flex items-center gap-1 tabular-nums"
                      classList={{
                        'text-ink-extra-muted': !date().startsWith(props.month),
                      }}
                    >
                      <span
                        class="flex size-5 shrink-0 items-center justify-center rounded-md border border-transparent"
                        classList={{
                          'border-accent bg-accent font-semibold text-accent-contrast':
                            date() === props.today,
                        }}
                      >
                        {Number(date().slice(-2))}
                      </span>
                    </span>
                    <Show when={column().overridden}>
                      <span class="text-[9px] text-ink-extra-muted">
                        Override
                      </span>
                    </Show>
                  </div>
                  <div
                    class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
                    classList={{
                      'pt-7': !!run() && !tallPreview(),
                      'pt-9': tallPreview(),
                    }}
                  >
                    <For each={['available', 'unavailable'] as const}>
                      {(mode) => (
                        <For
                          each={bars()[mode].filter(
                            (bar) => !coveredByPreview(mode, bar.window)
                          )}
                        >
                          {(bar) => {
                            const hours = () =>
                              availabilityTimeLabel(
                                bar.window,
                                props.timeFormat
                              );
                            return (
                              <button
                                type="button"
                                data-availability-item
                                data-mode={mode}
                                data-availability-preview={
                                  bar.draft ? 'true' : undefined
                                }
                                aria-label={`${dateLabel(date())}, ${mode}, ${hours()}`}
                                disabled={props.disabled || bar.draft}
                                class="min-w-0 shrink-0 rounded px-1 py-1 text-left text-[10px] leading-tight outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-100"
                                classList={{
                                  'bg-accent text-panel':
                                    mode === 'available' &&
                                    (active() || bar.draft),
                                  'bg-edge text-ink':
                                    mode === 'unavailable' ||
                                    (!active() && !bar.draft),
                                  'ring-1 ring-failure': !!bar.overlaps.length,
                                }}
                                onPointerDown={(event) => {
                                  suppressedClick = event.defaultPrevented;
                                }}
                                onClick={(event) => {
                                  if (event.detail && suppressedClick) return;
                                  if (props.stamping)
                                    props.onDates(
                                      [date()],
                                      event.currentTarget,
                                      true
                                    );
                                  else
                                    props.onSelect(
                                      change(mode, bar.window, bar.index),
                                      event.currentTarget,
                                      date()
                                    );
                                }}
                              >
                                <span class="block tabular-nums">
                                  {hours()}
                                </span>
                                <Show when={bar.overlaps.length}>
                                  <span class="block text-[9px]">Overlap</span>
                                </Show>
                              </button>
                            );
                          }}
                        </For>
                      )}
                    </For>
                  </div>
                </div>
              );
            }}
          </Index>
          <Show when={preview()}>
            {(selectionPreview) => (
              <For each={runs()}>
                {(run) => (
                  <AvailabilitySelectionBar
                    run={run}
                    preview={selectionPreview()}
                    timeFormat={props.timeFormat}
                    conflicting={conflicting(run)}
                  />
                )}
              </For>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}
