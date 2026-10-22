import {
  globalTabManager,
  setTabDragActive,
  tabStripMount,
} from '@app/signal/tabLayout';
import { TOKENS } from '@core/hotkey/tokens';
import PlusIcon from '@phosphor/plus.svg';
import SquareSplitIcon from '@phosphor/square-split-horizontal.svg';
import XIcon from '@phosphor/x.svg';
import {
  createDraggable,
  createDroppable,
  useDragDropContext,
} from '@thisbeyond/solid-dnd';
import { Button, cn, Tooltip } from '@ui';
import { For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import {
  isDesktopTabDragData,
  isDesktopTabSlotData,
  isTabDropZoneData,
} from './tab-drag';
import type { DesktopTab, TabManager } from './tab-manager';

function TabItem(props: { tabManager: TabManager; tab: DesktopTab }) {
  const title = () => props.tabManager.tabTitle(props.tab);
  const draggable = createDraggable(`desktop-tab:${props.tab.id}`, {
    dragType: 'desktop-tab',
    tabId: props.tab.id,
    get name() {
      return title();
    },
    overlayIcon: () => <SquareSplitIcon class="size-4 text-ink-muted" />,
  });
  const droppable = createDroppable(`desktop-tab-slot:${props.tab.id}`, {
    dragType: 'desktop-tab-slot',
    tabId: props.tab.id,
  });

  const active = () => props.tabManager.activeTabId() === props.tab.id;
  const paneCount = () => props.tabManager.tabPaneCount(props.tab);
  const closable = () => props.tabManager.tabs().length > 1;

  return (
    <div
      ref={(element) => {
        draggable.ref(element);
        droppable.ref(element);
      }}
      {...draggable.dragActivators}
      role="tab"
      aria-selected={active()}
      class={cn(
        'group flex h-7 min-w-9 max-w-44 flex-initial basis-40 items-center gap-1 rounded-md pl-2 pr-1 text-xs select-none',
        active()
          ? 'bg-active text-ink'
          : 'text-ink-muted not-touch:hover:bg-hover not-touch:hover:text-ink',
        droppable.isActiveDroppable && 'ring-1 ring-inset ring-accent',
        draggable.isActiveDraggable && 'opacity-50'
      )}
      onClick={() => props.tabManager.activateTab(props.tab.id)}
      onAuxClick={(event) => {
        if (event.button === 1 && closable()) {
          props.tabManager.closeTab(props.tab.id);
        }
      }}
    >
      <Show when={paneCount() > 1}>
        <Tooltip label={`${paneCount()} splits`} as="span">
          <span class="flex shrink-0 items-center gap-0.5 text-2xs text-ink-extra-muted">
            <SquareSplitIcon class="size-3.5" />
            {paneCount()}
          </span>
        </Tooltip>
      </Show>
      <Tooltip label={title()} as="span" class="min-w-0 flex-1">
        <span class="block truncate">{title()}</span>
      </Tooltip>
      <Show when={closable()}>
        <Button
          variant="ghost"
          size="icon-xs"
          label="Close Tab"
          noTouchResize
          class={cn(
            'shrink-0',
            !active() && 'invisible not-touch:group-hover:visible'
          )}
          onClick={(event) => {
            event.stopPropagation();
            props.tabManager.closeTab(props.tab.id);
          }}
        >
          <XIcon />
        </Button>
      </Show>
    </div>
  );
}

function TabStrip(props: { tabManager: TabManager }) {
  const [, dragActions] = useDragDropContext() ?? [];

  dragActions?.onDragStart(({ draggable }) => {
    if (isDesktopTabDragData(draggable.data)) setTabDragActive(true);
  });

  dragActions?.onDragEnd(({ draggable, droppable }) => {
    const data = draggable.data;
    if (!isDesktopTabDragData(data)) return;
    setTabDragActive(false);

    const over = droppable?.data;
    if (!over) return;

    if (isDesktopTabSlotData(over) && over.tabId !== data.tabId) {
      const to = props.tabManager
        .tabs()
        .findIndex((tab) => tab.id === over.tabId);
      if (to >= 0) props.tabManager.moveTab(data.tabId, to);
      return;
    }

    if (isTabDropZoneData(over)) {
      props.tabManager.dropTabIntoLayout(data.tabId, {
        kind: over.kind,
        index: over.index,
      });
    }
  });

  return (
    <div
      data-desktop-tab-strip
      class="flex h-full min-w-0 flex-1 items-center gap-1 px-2"
    >
      <div
        role="tablist"
        aria-label="Tabs"
        class="flex min-w-0 items-center gap-1 overflow-hidden"
      >
        <For each={props.tabManager.tabs()}>
          {(tab) => <TabItem tabManager={props.tabManager} tab={tab} />}
        </For>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        label="New Tab"
        hotkey={TOKENS.tabs.new}
        onClick={() => props.tabManager.newTab()}
      >
        <PlusIcon class="size-4" />
      </Button>
      <div data-tauri-drag-region class="h-full min-w-4 flex-1" />
    </div>
  );
}

/**
 * The browser-style tab strip. It renders inside the app chrome, where the
 * drag-and-drop provider lives, and portals into the title bar's center slot.
 */
export function DesktopTabStrip() {
  return (
    <Show when={globalTabManager()}>
      {(tabManager) => (
        <Show when={tabStripMount()}>
          {(mount) => (
            <Portal mount={mount()}>
              <TabStrip tabManager={tabManager()} />
            </Portal>
          )}
        </Show>
      )}
    </Show>
  );
}
