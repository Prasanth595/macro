import { isRecord } from '@app/lib/split-router';
import type { DesktopTabId, TabDropTarget } from './tab-manager';

export type DesktopTabDragData = {
  dragType: 'desktop-tab';
  tabId: DesktopTabId;
  name: string;
};

/** A droppable over another tab in the strip: reorder. */
export type DesktopTabSlotData = {
  dragType: 'desktop-tab-slot';
  tabId: DesktopTabId;
};

/** A droppable over the split layout: merge the tab into it. */
export type TabDropZoneData = {
  dragType: 'desktop-tab-drop-zone';
} & TabDropTarget;

function isTabId(value: unknown): value is DesktopTabId {
  return typeof value === 'string' && value.length > 0;
}

export function isDesktopTabDragData(
  data: unknown
): data is DesktopTabDragData {
  return (
    isRecord(data) && data.dragType === 'desktop-tab' && isTabId(data.tabId)
  );
}

export function isDesktopTabSlotData(
  data: unknown
): data is DesktopTabSlotData {
  return (
    isRecord(data) &&
    data.dragType === 'desktop-tab-slot' &&
    isTabId(data.tabId)
  );
}

export function isTabDropZoneData(data: unknown): data is TabDropZoneData {
  return (
    isRecord(data) &&
    data.dragType === 'desktop-tab-drop-zone' &&
    (data.kind === 'replace' || data.kind === 'insert') &&
    typeof data.index === 'number'
  );
}
