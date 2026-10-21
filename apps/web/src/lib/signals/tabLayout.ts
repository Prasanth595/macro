import type { TabManager } from '@components/app/tab-layout/tab-manager';
import { createSignal } from 'solid-js';

/**
 * The desktop tab manager, set while tabs are enabled (macOS desktop app).
 * Published globally like `globalSplitManager`, because the title bar, global
 * hotkeys, and the router middleware live outside the owning provider.
 */
export const [globalTabManager, setGlobalTabManager] =
  createSignal<TabManager>();

/**
 * Where the title bar mounts the tab strip. The strip renders inside the app
 * chrome (for drag-and-drop and split contexts) and portals into this element.
 */
export const [tabStripMount, setTabStripMount] = createSignal<HTMLDivElement>();

/** A tab from the strip is being dragged; split panels show drop zones. */
export const [tabDragActive, setTabDragActive] = createSignal(false);
