import { batch, createSignal } from 'solid-js';
import type { EventEditorInitialValues } from '../../calendar/components/composer/event-form-model';
import type { CalendarEvent } from '../../calendar/types';
import type { CalendarEditorRequest } from '../types';

export interface CalendarEditorDraft {
  event?: CalendarEvent;
  initialValues?: EventEditorInitialValues;
  /** Snapshot in viewport coordinates, independent of disposable grid elements. */
  anchor?: { x: number; y: number; width: number; height: number };
  onCalendarChange?: (calendarId: string, color: string) => void;
  onClose?: () => void;
}

/** Runtime command state stays with the request, not a disposable workspace. */
export function createCalendarEditorRequest(
  options: Pick<
    CalendarEditorDraft,
    'event' | 'initialValues' | 'onCalendarChange' | 'onClose'
  > = {}
): CalendarEditorRequest {
  let consumed = false;
  return {
    id: crypto.randomUUID(),
    event: options.event,
    initialValues: options.initialValues,
    onCalendarChange: options.onCalendarChange,
    onClose: options.onClose,
    consume: () => {
      if (consumed) return false;
      consumed = true;
      return true;
    },
  };
}

export function createCalendarEditor() {
  const [draft, setDraft] = createSignal<CalendarEditorDraft>();
  const [surface, setSurface] = createSignal<'popover' | 'sidebar'>('sidebar');

  const open = (next: CalendarEditorDraft = {}) => {
    if (draft()) return false;
    batch(() => {
      setSurface(next.anchor ? 'popover' : 'sidebar');
      setDraft(next);
    });
    return true;
  };
  const close = () => {
    const current = draft();
    if (!current) return;
    setDraft(undefined);
    current.onClose?.();
  };

  return {
    draft,
    surface,
    open,
    close,
    moveToSidebar: () => setSurface('sidebar'),
  };
}
