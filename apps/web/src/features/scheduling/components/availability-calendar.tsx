import { ToggleSwitch } from '@ui';
import { createMemo, createSignal, For, Index, onMount, Show } from 'solid-js';
import { createPointerAutoScroll } from '../../../components/drag-drop/create-pointer-auto-scroll';
import {
  type AvailabilityChange,
  type AvailabilityTarget,
  dateWeekday,
  drawnWindow,
  timeMinutes,
  windowsIssue,
} from '../core/availability';
import {
  availabilityBars,
  movedAvailabilityWindow,
} from '../core/availability-bars';
import type { TimeWindow } from '../core/types';
import {
  type AvailabilityBlob,
  AvailabilityBlobLayer,
} from './availability-blob-layer';
import { AvailabilityRangeCard } from './availability-range-card';

export type AvailabilityColumn = {
  target: AvailabilityTarget;
  label: string;
  dateLabel?: string;
  inherited: boolean;
  overridden: boolean;
  windows: TimeWindow[];
  weeklyWindows: TimeWindow[];
  weeklyEnabled: boolean;
  unavailable: TimeWindow[];
};

export function AvailabilityCalendar(props: {
  columns: AvailabilityColumn[];
  disabled: boolean;
  mode: 'available' | 'unavailable';
  popoverOpen?: boolean;
  onDismissPopover: () => void;
  selected?: AvailabilityChange;
  draft?: AvailabilityChange;
  onDraw: (change: AvailabilityChange, anchor: HTMLElement) => void;
  onSelect: (change: AvailabilityChange, anchor: HTMLElement) => void;
  onToggle: (target: AvailabilityTarget, checked: boolean) => void;
}) {
  const [drawing, setDrawing] = createSignal<{
    column: number;
    pointerId: number;
    anchor: number;
    position: number;
    capture: HTMLElement;
  }>();
  const [moving, setMoving] = createSignal<{
    column: number;
    pointerId: number;
    anchorMinute: number;
    position: number;
    clientY: number;
    moved: boolean;
    anchor: HTMLElement;
    capture: HTMLElement;
    change: AvailabilityChange;
  }>();
  let pointer: { x: number; y: number } | undefined;
  let suppressedClick: HTMLElement | undefined;
  const beginMove = (
    change: AvailabilityChange,
    column: number,
    event: PointerEvent
  ) => {
    if (event.defaultPrevented || props.popoverOpen) {
      suppressedClick = event.currentTarget as HTMLElement;
      return;
    }
    if (
      props.disabled ||
      drawing() ||
      moving() ||
      event.button !== 0 ||
      change.allDay
    )
      return;
    const anchor = event.currentTarget as HTMLElement;
    const day = anchor.closest<HTMLElement>('[data-availability-day]');
    if (!day) return;
    event.stopPropagation();
    event.preventDefault();
    suppressedClick = undefined;
    day.focus({ preventScroll: true });
    day.setPointerCapture(event.pointerId);
    const rect = day.getBoundingClientRect();
    const minute = ((event.clientY - rect.top) / rect.height) * 1440;
    pointer = { x: event.clientX, y: event.clientY };
    setMoving({
      column,
      pointerId: event.pointerId,
      anchorMinute: minute,
      position: minute,
      clientY: event.clientY,
      moved: false,
      anchor,
      capture: day,
      change: {
        ...change,
        window: { ...change.window },
        origin: { mode: change.mode, window: { ...change.window } },
      },
    });
  };
  const select = (
    change: AvailabilityChange,
    anchor: HTMLElement,
    event: MouseEvent
  ) => {
    if (drawing() || moving()) return;
    if (
      event.detail > 0 &&
      (suppressedClick === anchor ||
        suppressedClick === anchor.closest('[data-availability-day]'))
    )
      return;
    if (props.popoverOpen) return;
    props.onSelect(change, anchor);
  };
  let scroll!: HTMLDivElement;
  let header!: HTMLDivElement;
  const updateDragPosition = () => {
    if (!pointer) return;
    const current = drawing();
    const move = moving();
    const capture = current?.capture ?? move?.capture;
    if (!capture) return;
    const rect = capture.getBoundingClientRect();
    const minute = ((pointer.y - rect.top) / rect.height) * 1440;
    if (current) setDrawing({ ...current, position: minute });
    else if (move) setMoving({ ...move, position: minute });
  };
  const autoScroll = createPointerAutoScroll({
    getViewport: () => scroll,
    getPointer: () => (drawing() || moving()?.moved ? pointer : undefined),
    getBounds: (viewport) => {
      const bounds = viewport.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: header.getBoundingClientRect().bottom,
        bottom: bounds.bottom,
      };
    },
    axis: 'y',
    allowOutside: true,
    onScroll: updateDragPosition,
  });
  onMount(() => {
    scroll.scrollTop = 7 * 64;
  });
  const position = (event: PointerEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return ((event.clientY - rect.top) / rect.height) * 1440;
  };
  const preview = () => {
    const current = drawing();
    return current ? drawnWindow(current.anchor, current.position) : undefined;
  };
  const windowStyle = (window: TimeWindow) => ({
    top: `${(timeMinutes(window.start) / 1440) * 100}%`,
    height: `${((timeMinutes(window.end) - timeMinutes(window.start)) / 1440) * 100}%`,
  });
  const isSelected = (change: AvailabilityChange) => {
    const selected = props.selected;
    return (
      selected?.mode === change.mode &&
      selected.window.start === change.window.start &&
      selected.window.end === change.window.end &&
      (selected.target.kind === 'weekly' && change.target.kind === 'weekly'
        ? selected.target.day === change.target.day
        : selected.target.kind === 'date' &&
          change.target.kind === 'date' &&
          selected.target.date === change.target.date)
    );
  };
  const draftWindow = (column: AvailabilityColumn, index: number) => {
    const move = moving();
    if (move?.column === index && move.moved)
      return movedAvailabilityWindow(
        move.change.window,
        move.position - move.anchorMinute
      );
    if (drawing()?.column === index) return preview();
    const draft = props.draft;
    if (!draft) return;
    if (draft.target.kind === 'weekly' && column.overridden) return;
    const sameTarget =
      draft.target.kind === 'weekly'
        ? draft.target.day ===
          (column.target.kind === 'weekly'
            ? column.target.day
            : dateWeekday(column.target.date))
        : draft.target.kind === 'date' &&
          column.target.kind === 'date' &&
          draft.target.date === column.target.date;
    if (!sameTarget) return;
    if (draft.allDay) return { start: '00:00', end: '23:59' };
    return windowsIssue([draft.window]) ? undefined : draft.window;
  };
  return (
    <div
      ref={scroll}
      class="min-h-0 flex-1 overflow-auto overscroll-contain bg-panel"
      aria-label="Availability calendar"
      onScroll={updateDragPosition}
      onPointerDown={() => {
        if (!props.popoverOpen) return;
        // Touch outside events wait for click; a drag or disabled bar can omit it.
        props.onDismissPopover();
      }}
    >
      <div class="min-w-[640px]">
        <div
          ref={header}
          class="sticky top-0 z-20 grid h-32 grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-edge-muted bg-panel"
        >
          <div class="flex items-end justify-end pr-2 pb-3 text-[11px] text-ink-extra-muted">
            Time
          </div>
          <Index each={props.columns}>
            {(column) => (
              <div class="flex min-h-20 flex-col items-center gap-2 px-1 pt-2 pb-3 text-center">
                <span class="text-sm font-normal text-ink-extra-muted">
                  {column().label.slice(0, 3)}
                </span>
                <Show when={column().dateLabel}>
                  <span class="flex size-8 items-center justify-center text-2xl font-normal text-ink">
                    {column().dateLabel?.split(' ').at(-1)}
                  </span>
                </Show>
                <ToggleSwitch
                  size="xs"
                  label={
                    <span class="sr-only">{column().label} availability</span>
                  }
                  checked={column().weeklyEnabled}
                  disabled={props.disabled}
                  onChange={(checked) => {
                    const target = column().target;
                    props.onToggle(
                      target.kind === 'weekly'
                        ? target
                        : { kind: 'weekly', day: dateWeekday(target.date) },
                      checked
                    );
                  }}
                />
                <Show when={column().overridden}>
                  <span class="text-[10px] text-ink-muted">Override</span>
                </Show>
              </div>
            )}
          </Index>
        </div>
        <div class="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          <div class="relative h-[1536px] select-none text-[11px] text-ink-extra-muted">
            <For each={Array.from({ length: 24 }, (_, hour) => hour)}>
              {(hour) => (
                <span
                  class="absolute right-2 -translate-y-1/2 tabular-nums"
                  style={{ top: `${(hour / 24) * 100}%` }}
                >
                  {hour === 0
                    ? ''
                    : `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`}
                </span>
              )}
            </For>
          </div>
          <Index each={props.columns}>
            {(column, index) => {
              const current = () => {
                const window = draftWindow(column(), index);
                if (!window) return;
                const move = moving();
                const change =
                  move?.column === index && move.moved
                    ? move.change
                    : props.draft;
                return {
                  ...(change ?? {
                    target: column().target,
                    mode: props.mode,
                  }),
                  window,
                };
              };
              const bars = createMemo(() =>
                availabilityBars(
                  column().windows,
                  column().unavailable,
                  current(),
                  column().overridden || column().weeklyEnabled
                )
              );
              const blobs = (
                mode: AvailabilityChange['mode']
              ): AvailabilityBlob[] => {
                const change = current();
                const source =
                  mode === 'available'
                    ? change?.mode === 'unavailable'
                      ? bars().available.map((bar) => bar.window)
                      : column().windows
                    : change?.mode === 'available' &&
                        change.origin?.mode === 'unavailable'
                      ? bars().unavailable.map((bar) => bar.window)
                      : column().unavailable;
                const windows = source.filter(
                  (window, windowIndex) =>
                    change?.origin?.mode !== mode ||
                    change.mode !== mode ||
                    (mode === 'available'
                      ? windowIndex !== change.index
                      : window.start !== change.origin.window.start ||
                        window.end !== change.origin.window.end)
                );
                return [
                  ...windows.map((window) => ({
                    window,
                    gray:
                      mode === 'unavailable' ||
                      (!column().overridden && !column().weeklyEnabled),
                  })),
                  ...(change?.mode === mode
                    ? [
                        {
                          window: change.window,
                          gray: mode === 'unavailable',
                        },
                      ]
                    : []),
                ];
              };
              const joining = () => {
                const change = current();
                if (!change) return;
                const peers = blobs(change.mode).slice(0, -1);
                return peers.some(
                  ({ window }) =>
                    window.start <= change.window.end &&
                    window.end >= change.window.start
                )
                  ? change.mode
                  : undefined;
              };
              const label = () =>
                column().label +
                (column().dateLabel ? ` ${column().dateLabel}` : '');
              const availableTarget = (): AvailabilityTarget => {
                const target = column().target;
                return column().inherited && target.kind === 'date'
                  ? { kind: 'weekly', day: dateWeekday(target.date) }
                  : target;
              };
              return (
                <div
                  class="relative h-[1536px] touch-none select-none border-l border-edge-muted outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                  role="group"
                  data-availability-day
                  tabIndex={props.disabled ? undefined : 0}
                  aria-label={`${column().label}, ${column().dateLabel ?? 'recurring availability'}. Drag to select hours, or press Enter to add a range.`}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      autoScroll.stop();
                      pointer = undefined;
                      if (moving()?.moved) suppressedClick = moving()?.anchor;
                      setDrawing(undefined);
                      setMoving(undefined);
                    }
                    if (
                      (event.key === 'Enter' || event.key === ' ') &&
                      event.target === event.currentTarget &&
                      !props.disabled &&
                      !props.popoverOpen &&
                      !drawing() &&
                      !moving()
                    ) {
                      event.preventDefault();
                      props.onDraw(
                        {
                          target: column().target,
                          mode: props.mode,
                          window: { start: '09:00', end: '10:00' },
                        },
                        event.currentTarget
                      );
                    }
                  }}
                  onPointerDown={(event) => {
                    if (event.defaultPrevented || props.popoverOpen) {
                      suppressedClick = event.currentTarget;
                      return;
                    }
                    if (
                      props.disabled ||
                      drawing() ||
                      moving() ||
                      event.button !== 0 ||
                      event.target !== event.currentTarget
                    )
                      return;
                    suppressedClick = undefined;
                    event.preventDefault();
                    event.currentTarget.focus({ preventScroll: true });
                    event.currentTarget.setPointerCapture(event.pointerId);
                    const minute = position(event);
                    pointer = { x: event.clientX, y: event.clientY };
                    setDrawing({
                      column: index,
                      pointerId: event.pointerId,
                      anchor: minute,
                      position: minute,
                      capture: event.currentTarget,
                    });
                  }}
                  onPointerMove={(event) => {
                    const move = moving();
                    if (
                      move?.column === index &&
                      move.pointerId === event.pointerId
                    ) {
                      pointer = { x: event.clientX, y: event.clientY };
                      setMoving({
                        ...move,
                        position: position(event),
                        moved:
                          move.moved ||
                          Math.abs(event.clientY - move.clientY) >= 4,
                      });
                      if (moving()?.moved) autoScroll.start();
                      return;
                    }
                    const current = drawing();
                    if (
                      current?.column === index &&
                      current.pointerId === event.pointerId
                    ) {
                      pointer = { x: event.clientX, y: event.clientY };
                      setDrawing({ ...current, position: position(event) });
                      autoScroll.start();
                    }
                  }}
                  onPointerUp={(event) => {
                    const move = moving();
                    if (
                      move?.column === index &&
                      move.pointerId === event.pointerId
                    ) {
                      autoScroll.stop();
                      pointer = undefined;
                      const window = movedAvailabilityWindow(
                        move.change.window,
                        position(event) - move.anchorMinute
                      );
                      setMoving(undefined);
                      move.capture.releasePointerCapture(event.pointerId);
                      event.preventDefault();
                      suppressedClick = move.anchor;
                      if (move.moved)
                        props.onDraw({ ...move.change, window }, move.capture);
                      else props.onSelect(move.change, move.anchor);
                      return;
                    }
                    const current = drawing();
                    if (
                      current?.column !== index ||
                      current.pointerId !== event.pointerId
                    )
                      return;
                    autoScroll.stop();
                    pointer = undefined;
                    const window = drawnWindow(current.anchor, position(event));
                    setDrawing(undefined);
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    props.onDraw(
                      {
                        target: column().target,
                        mode: props.mode,
                        window,
                      },
                      event.currentTarget
                    );
                  }}
                  onPointerCancel={(event) => {
                    if (
                      drawing()?.pointerId !== event.pointerId &&
                      moving()?.pointerId !== event.pointerId
                    )
                      return;
                    autoScroll.stop();
                    pointer = undefined;
                    if (drawing()?.pointerId === event.pointerId)
                      setDrawing(undefined);
                    if (moving()?.pointerId === event.pointerId)
                      setMoving(undefined);
                  }}
                  onLostPointerCapture={(event) => {
                    if (
                      drawing()?.pointerId !== event.pointerId &&
                      moving()?.pointerId !== event.pointerId
                    )
                      return;
                    autoScroll.stop();
                    pointer = undefined;
                    if (drawing()?.pointerId === event.pointerId)
                      setDrawing(undefined);
                    if (moving()?.pointerId === event.pointerId)
                      setMoving(undefined);
                  }}
                >
                  <For
                    each={Array.from({ length: 48 }, (_, halfHour) => halfHour)}
                  >
                    {(halfHour) => (
                      <div
                        class="pointer-events-none absolute inset-x-0 border-t"
                        classList={{
                          'border-edge-muted': halfHour % 2 === 0,
                          'border-transparent': halfHour % 2 !== 0,
                        }}
                        style={{ top: `${(halfHour / 48) * 100}%` }}
                      />
                    )}
                  </For>
                  <AvailabilityBlobLayer
                    available={blobs('available')}
                    unavailable={blobs('unavailable')}
                    joining={joining()}
                    preview={current()?.mode}
                  />
                  <Index each={bars().available}>
                    {(bar) => {
                      const change = (): AvailabilityChange => ({
                        target: bar().draft
                          ? (current()?.target ?? availableTarget())
                          : availableTarget(),
                        window: bar().window,
                        mode: 'available',
                        index: bar().index,
                        allDay:
                          bar().window.start === '00:00' &&
                          bar().window.end === '23:59',
                      });
                      return (
                        <AvailabilityRangeCard
                          change={change()}
                          label={label()}
                          transparent
                          entryStart={
                            bar().draft &&
                            bar().window.start !== current()?.window.start
                              ? current()?.window.start
                              : undefined
                          }
                          onMoveStart={(event) => {
                            if (column().overridden || column().weeklyEnabled)
                              beginMove(change(), index, event);
                          }}
                          overridden={change().target.kind === 'date'}
                          inactive={
                            !column().overridden &&
                            !column().weeklyEnabled &&
                            !bar().draft
                          }
                          draft={bar().draft}
                          disabled={props.disabled}
                          selected={isSelected(change())}
                          overlaps={bar().overlaps}
                          style={windowStyle(bar().window)}
                          onSelect={(anchor, event) =>
                            select(change(), anchor, event)
                          }
                        />
                      );
                    }}
                  </Index>
                  <Index each={bars().unavailable}>
                    {(bar) => {
                      const change = (): AvailabilityChange => ({
                        target: column().target,
                        window: bar().window,
                        mode: 'unavailable',
                        allDay:
                          bar().window.start === '00:00' &&
                          bar().window.end === '23:59',
                      });
                      return (
                        <AvailabilityRangeCard
                          change={change()}
                          label={label()}
                          draft={bar().draft}
                          transparent
                          entryStart={
                            bar().draft &&
                            bar().window.start !== current()?.window.start
                              ? current()?.window.start
                              : undefined
                          }
                          onMoveStart={(event) =>
                            beginMove(change(), index, event)
                          }
                          disabled={props.disabled}
                          overridden
                          selected={isSelected(change())}
                          overlaps={bar().overlaps}
                          style={windowStyle(bar().window)}
                          onSelect={(anchor, event) =>
                            select(change(), anchor, event)
                          }
                        />
                      );
                    }}
                  </Index>
                </div>
              );
            }}
          </Index>
        </div>
      </div>
    </div>
  );
}
