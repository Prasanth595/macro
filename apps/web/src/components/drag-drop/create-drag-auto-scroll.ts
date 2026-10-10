import { useDragDropContext } from '@thisbeyond/solid-dnd';
import { createEffect, on, onCleanup } from 'solid-js';
import { createPointerAutoScroll } from './create-pointer-auto-scroll';

/** Scroll the active solid-dnd surface while the pointer rests near its edge. */
export function createDragAutoScroll(options: {
  getViewport: () => HTMLElement | undefined;
  axis: 'x' | 'both';
}) {
  const context = useDragDropContext();
  if (!context) throw new Error('Drag auto-scroll requires DragDropProvider');
  const [state, actions] = context;
  const autoScroll = createPointerAutoScroll({
    ...options,
    getPointer: () => state.active.sensor?.coordinates.current,
    onScroll: () => actions.detectCollisions(),
  });
  createEffect(
    on(
      () => state.active.draggableId,
      (id) => {
        if (id === null) return;
        autoScroll.start();
        onCleanup(autoScroll.stop);
      }
    )
  );
}
