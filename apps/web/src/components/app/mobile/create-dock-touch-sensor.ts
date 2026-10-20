import { touchHandler } from '@core/directive/touchHandler';
import { useDragDropContext } from '@thisbeyond/solid-dnd';
import { onCleanup, onMount } from 'solid-js';

/** Long-press handles start sorting; moving before activation remains a scroll. */
export function createDockTouchSensor(onCancel: () => void) {
  const context = useDragDropContext();
  if (!context) throw new Error('Dock touch sensor requires DragDropProvider');
  const [state, actions] = context;
  const id = 'dock-touch';
  let touchId: number | undefined;
  let cancelPending: (() => void) | undefined;
  let disposed = false;
  const active = () => state.active.sensorId === id;

  const finish = (cancelled: boolean) => {
    if (!active()) return;
    if (cancelled) onCancel();
    if (state.active.draggable) actions.dragEnd();
    actions.sensorEnd();
    touchId = undefined;
  };
  const cancel = () => {
    cancelPending?.();
    cancelPending = undefined;
    finish(true);
  };
  const move = (event: TouchEvent) => {
    if (!active()) return;
    if (event.touches.length !== 1) return cancel();
    const touch = Array.from(event.touches).find(
      (touch) => touch.identifier === touchId
    );
    if (!touch) return cancel();
    event.preventDefault();
    actions.sensorMove({ x: touch.clientX, y: touch.clientY });
  };
  const end = (event: TouchEvent) => {
    cancelPending?.();
    cancelPending = undefined;
    if (!active()) return;
    event.preventDefault();
    finish(false);
  };
  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !active()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancel();
  };
  const start = (event: TouchEvent) => {
    if (event.touches.length > 1) cancel();
  };
  onMount(() => {
    actions.addSensor({ id, activators: {} });
    document.addEventListener('touchmove', move, {
      capture: true,
      passive: false,
    });
    document.addEventListener('touchend', end, {
      capture: true,
      passive: false,
    });
    document.addEventListener('touchcancel', cancel, true);
    document.addEventListener('touchstart', start, true);
    document.addEventListener('keydown', cancelOnEscape, true);
    window.addEventListener('blur', cancel);
  });
  onCleanup(() => {
    disposed = true;
    cancel();
    actions.removeSensor(id);
    document.removeEventListener('touchmove', move, true);
    document.removeEventListener('touchend', end, true);
    document.removeEventListener('touchcancel', cancel, true);
    document.removeEventListener('touchstart', start, true);
    document.removeEventListener('keydown', cancelOnEscape, true);
    window.removeEventListener('blur', cancel);
  });

  return (element: HTMLElement, draggableId: string) => {
    const cancelTouch = touchHandler(element, () => ({
      delay: 300,
      stopTouchStartPropagation: true,
      onTouchStart: () => {
        cancelPending = cancelTouch;
      },
      onCancel: () => {
        if (cancelPending === cancelTouch) cancelPending = undefined;
      },
      onLongPress: (event) => {
        if (disposed || !element.isConnected || state.active.sensor) return;
        const touch = event.touches[0];
        touchId = touch.identifier;
        actions.sensorStart(id, { x: touch.clientX, y: touch.clientY });
        actions.dragStart(draggableId);
      },
    }));
  };
}
