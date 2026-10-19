import { batch, createSignal } from 'solid-js';
import type { EventEditorInitialValues } from '../../calendar/components/composer/event-form-model';

export interface CalendarCreationDraft {
  initialValues?: EventEditorInitialValues;
  /** Snapshot in viewport coordinates, independent of disposable grid elements. */
  anchor?: { x: number; y: number; width: number; height: number };
  onCalendarChange?: (calendarId: string, color: string) => void;
  onClose?: () => void;
}

export function createCalendarCreation() {
  const [draft, setDraft] = createSignal<CalendarCreationDraft>();
  const [surface, setSurface] = createSignal<'popover' | 'sidebar'>('sidebar');

  const open = (next: CalendarCreationDraft = {}) => {
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
