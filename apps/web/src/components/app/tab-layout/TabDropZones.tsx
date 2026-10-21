import { tabDragActive } from '@app/signal/tabLayout';
import { createDroppable } from '@thisbeyond/solid-dnd';
import { cn } from '@ui';
import { Show } from 'solid-js';
import type { TabDropTarget } from './tab-manager';

function DropZone(props: { target: TabDropTarget; class?: string }) {
  const droppable = createDroppable(
    `desktop-tab-drop:${props.target.kind}:${props.target.index}`,
    {
      dragType: 'desktop-tab-drop-zone',
      kind: props.target.kind,
      index: props.target.index,
    }
  );

  return (
    <div
      ref={droppable.ref}
      class={cn(
        'm-1 rounded-lg border-2 border-dashed border-transparent transition-colors',
        droppable.isActiveDroppable && 'border-accent bg-selected/60',
        props.class
      )}
    />
  );
}

/**
 * Shown over each split while a tab is dragged from the strip: the edges
 * insert the tab's panes beside this split, the middle replaces it.
 */
export function TabDropZones(props: { index: number }) {
  return (
    <Show when={tabDragActive()}>
      <div class="absolute inset-0 z-split-panel-chrome flex">
        {/* Only the first panel owns a left zone; every other boundary is the
            previous panel's right zone, keeping droppable ids unique. */}
        <Show when={props.index === 0}>
          <DropZone
            target={{ kind: 'insert', index: props.index }}
            class="w-1/5"
          />
        </Show>
        <DropZone
          target={{ kind: 'replace', index: props.index }}
          class="flex-1"
        />
        <DropZone
          target={{ kind: 'insert', index: props.index + 1 }}
          class="w-1/5"
        />
      </div>
    </Show>
  );
}
