import { batch, createSignal } from 'solid-js';
import type { EventEditorInitialValues } from '../../calendar/components/composer/event-form-model';
import type { CalendarEvent } from '../../calendar/types';
import type { CalendarEditorRequest } from '../types';

export type CalendarEditorPresentation = 'popover' | 'sidebar';
export interface CalendarEditorDraft {
  event?: CalendarEvent;
  initialValues?: EventEditorInitialValues;
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
  const [surface, setSurface] =
    createSignal<CalendarEditorPresentation>('popover');
  let beforeReplace: (() => Promise<boolean>) | undefined;

  const open = (
    next: CalendarEditorDraft = {},
    presentation: CalendarEditorPresentation = 'popover'
  ) => {
    if (draft()) return false;
    batch(() => {
      setSurface(presentation);
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

  const registerBeforeReplace = (guard: () => Promise<boolean>) => {
    beforeReplace = guard;
    return () => {
      if (beforeReplace === guard) beforeReplace = undefined;
    };
  };
  const replace = async (next: CalendarEditorDraft) => {
    const current = draft();
    if (current && beforeReplace && !(await beforeReplace())) return false;
    if (draft() !== current) return false;
    return batch(() => {
      close();
      return open(next);
    });
  };

  return {
    draft,
    surface,
    moveToSidebar: () => {
      if (draft()) setSurface('sidebar');
    },
    open,
    close,
    replace,
    registerBeforeReplace,
  };
}
