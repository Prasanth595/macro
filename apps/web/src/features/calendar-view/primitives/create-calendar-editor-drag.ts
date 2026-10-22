import { fireAndForget } from '@core/util/fireAndForget';
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  type VirtualElement,
} from '@floating-ui/dom';
import { Telemetry } from '@macro-inc/observability';
import {
  type Accessor,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';
import type { CalendarEditorPresentation } from './create-calendar-editor';

const INSET = 12;
const THRESHOLD = 5;
type Point = { x: number; y: number };

/** Geometry and gestures for the mounted desktop editor, independent of its owner. */
export function createCalendarEditorDrag(options: {
  boundary: HTMLElement;
  slot: Accessor<HTMLElement | undefined>;
  panel: Accessor<HTMLElement | undefined>;
  anchor: Accessor<HTMLElement | undefined>;
  anchorRect?: DOMRect;
  surface: Accessor<CalendarEditorPresentation>;
  pending: Accessor<boolean>;
  onDropFromSidebar: () => void;
}) {
  const [dragging, setDragging] = createSignal(false);
  const [dropped, setDropped] = createSignal<Point>();
  let gesture:
    | {
        pointerId: number;
        header: HTMLElement;
        start: Point;
        origin: Point;
        source: CalendarEditorPresentation;
        span?: ReturnType<typeof Telemetry.span>;
      }
    | undefined;
  let generation = 0;
  let lastAnchorRect = options.anchorRect;

  const area = () => {
    const rect = options.boundary.getBoundingClientRect();
    const left = Math.max(INSET, rect.left + INSET);
    const top = Math.max(INSET, rect.top + INSET);
    return {
      left,
      top,
      width: Math.max(
        0,
        Math.min(window.innerWidth - INSET, rect.right - INSET) - left
      ),
      height: Math.max(
        0,
        Math.min(window.innerHeight - INSET, rect.bottom - INSET) - top
      ),
    };
  };
  const clamp = (point: Point, panel: HTMLElement): Point => {
    const bounds = area();
    return {
      x: Math.max(
        bounds.left,
        Math.min(
          point.x,
          bounds.left + Math.max(0, bounds.width - panel.offsetWidth)
        )
      ),
      y: Math.max(
        bounds.top,
        Math.min(
          point.y,
          bounds.top + Math.max(0, bounds.height - panel.offsetHeight)
        )
      ),
    };
  };
  const place = (panel: HTMLElement, point: Point) => {
    panel.style.left = `${point.x}px`;
    panel.style.top = `${point.y}px`;
    panel.style.visibility = 'visible';
  };
  const reference: VirtualElement = {
    contextElement: options.boundary,
    getBoundingClientRect: () => {
      const element = options.anchor();
      if (element?.isConnected) {
        lastAnchorRect = element.getBoundingClientRect();
      }
      if (lastAnchorRect) return lastAnchorRect;
      const rect = options.boundary.getBoundingClientRect();
      return new DOMRect(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
    },
  };

  createEffect(
    on(
      () =>
        [
          options.panel(),
          options.slot(),
          options.surface(),
          dragging(),
          dropped(),
          options.anchor(),
        ] as const,
      ([panel, slot, surface, active, last]) => {
        if (!panel) return;
        const current = ++generation;
        let updateId = 0;
        const update = () => {
          if (current !== generation || active) return;
          const id = ++updateId;
          const bounds = area();
          if (surface === 'sidebar' && !last) {
            if (!slot) return;
            const rect = slot.getBoundingClientRect();
            panel.style.width = `${Math.min(rect.width, bounds.width)}px`;
            panel.style.height = `${Math.min(rect.height, bounds.height)}px`;
            panel.style.maxHeight = `${Math.min(rect.height, bounds.height)}px`;
            place(panel, clamp({ x: rect.left, y: rect.top }, panel));
          } else if (last) {
            panel.style.width = `${Math.min(480, bounds.width)}px`;
            panel.style.height = '';
            panel.style.maxHeight = `${bounds.height}px`;
            const next = clamp(last, panel);
            place(panel, next);
            if (next.x !== last.x || next.y !== last.y) setDropped(next);
          } else {
            panel.style.width = `${Math.min(480, bounds.width)}px`;
            panel.style.height = '';
            panel.style.maxHeight = `${bounds.height}px`;
            const position = async () => {
              const { x, y } = await computePosition(reference, panel, {
                strategy: 'fixed',
                placement: 'right-start',
                middleware: [
                  offset(8),
                  flip({ boundary: options.boundary, padding: INSET }),
                  shift({
                    boundary: options.boundary,
                    padding: INSET,
                    crossAxis: true,
                  }),
                ],
              });
              if (current === generation && id === updateId)
                place(panel, clamp({ x, y }, panel));
            };
            fireAndForget(position(), 'calendar-editor-position');
          }
        };
        const anchor = options.anchor();
        reference.contextElement = anchor?.isConnected
          ? anchor
          : options.boundary;
        const stop = autoUpdate(reference, panel, update);
        const resizeObserver = new ResizeObserver(update);
        resizeObserver.observe(options.boundary);
        if (slot) resizeObserver.observe(slot);
        // Grid pages recycle their anchors without changing the editor draft.
        const observer = anchor?.isConnected
          ? new MutationObserver(() => {
              if (!anchor.isConnected) {
                observer?.disconnect();
                update();
              }
            })
          : undefined;
        observer?.observe(options.boundary, { childList: true, subtree: true });
        window.addEventListener('resize', update);
        onCleanup(() => {
          ++generation;
          stop();
          resizeObserver.disconnect();
          observer?.disconnect();
          window.removeEventListener('resize', update);
        });
      }
    )
  );

  const finish = (outcome: 'dropped' | 'cancelled') => {
    const current = gesture;
    if (!current) return;
    gesture = undefined;
    current.span?.setAttr('outcome', outcome);
    current.span?.end();
    if (current.header.hasPointerCapture(current.pointerId))
      current.header.releasePointerCapture(current.pointerId);
    setDragging(false);
  };
  const onPointerDown = (event: PointerEvent) => {
    if (options.pending() || gesture || event.button !== 0 || !event.isPrimary)
      return;
    const header = event.currentTarget;
    const target = event.target;
    const panel = options.panel();
    if (
      !(header instanceof HTMLElement) ||
      !(target instanceof Element) ||
      !panel ||
      !header.contains(target) ||
      target.closest(
        'button, a, input, select, textarea, [role="button"], [data-no-drag]'
      )
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const rect = panel.getBoundingClientRect();
    gesture = {
      pointerId: event.pointerId,
      header,
      start: { x: event.clientX, y: event.clientY },
      origin: { x: rect.left, y: rect.top },
      source: options.surface(),
    };
    header.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    const current = gesture;
    const panel = options.panel();
    if (!current || current.pointerId !== event.pointerId || !panel) return;
    const dx = event.clientX - current.start.x;
    const dy = event.clientY - current.start.y;
    if (!dragging()) {
      if (Math.hypot(dx, dy) < THRESHOLD) return;
      current.span = Telemetry.span('calendar.editor.drag');
      current.span.setAttr('source', current.source);
      const height = Math.min(
        560,
        area().height,
        current.source === 'sidebar'
          ? panel.getBoundingClientRect().height * 0.8
          : area().height
      );
      panel.style.height = '';
      panel.style.maxHeight = `${height}px`;
      setDragging(true);
    }
    event.preventDefault();
    place(
      panel,
      clamp({ x: current.origin.x + dx, y: current.origin.y + dy }, panel)
    );
  };
  const onPointerUp = (event: PointerEvent) => {
    if (gesture?.pointerId !== event.pointerId) return;
    if (!dragging()) {
      finish('cancelled');
      return;
    }
    const panel = options.panel();
    const rect = panel?.getBoundingClientRect();
    if (panel && rect) setDropped(clamp({ x: rect.left, y: rect.top }, panel));
    finish('dropped');
    if (panel && options.surface() === 'sidebar') options.onDropFromSidebar();
  };
  const onCancel = () => finish('cancelled');
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !gesture) return;
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  };
  window.addEventListener('blur', onCancel);
  window.addEventListener('keydown', onKeyDown, true);
  createEffect(
    on(options.pending, (pending) => {
      if (pending) onCancel();
    })
  );
  onCleanup(() => {
    onCancel();
    window.removeEventListener('blur', onCancel);
    window.removeEventListener('keydown', onKeyDown, true);
  });

  return {
    dragging,
    reserveSlot: () => options.surface() === 'sidebar',
    clearDrop: () => setDropped(undefined),
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onCancel,
    onLostPointerCapture: onCancel,
  };
}
