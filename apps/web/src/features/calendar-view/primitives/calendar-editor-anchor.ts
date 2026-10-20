import type { DateSelectArg } from '@fullcalendar/core';

export interface CalendarEditorAnchor {
  rect: DOMRect;
  element?: HTMLElement;
}

/** Capture the selected range before its grid page or preview is recycled. */
export function calendarSelectionAnchor(
  selection: Pick<DateSelectArg, 'jsEvent'>
): CalendarEditorAnchor | undefined {
  const pointer = selection.jsEvent;
  if (!pointer) return;
  const target = pointer.target;
  if (!(target instanceof Element)) return;

  const previews = target
    .closest('.fc')
    ?.querySelectorAll<HTMLElement>('.fc-event-mirror, .fc-highlight');
  for (const preview of previews ?? []) {
    const rect = preview.getBoundingClientRect();
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      pointer.clientX >= rect.left &&
      pointer.clientX <= rect.right &&
      pointer.clientY >= rect.top &&
      pointer.clientY <= rect.bottom
    ) {
      return { rect, element: preview };
    }
  }

  const column = target.closest('[data-date]')?.getBoundingClientRect();
  return {
    rect: new DOMRect(
      column?.left ?? pointer.clientX,
      pointer.clientY,
      column?.width ?? 0,
      0
    ),
  };
}
