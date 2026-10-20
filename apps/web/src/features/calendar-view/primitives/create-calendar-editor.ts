import { batch, createSignal } from 'solid-js';
import type { EventEditorInitialValues } from '../../calendar/components/composer/event-form-model';
import type { CalendarEvent } from '../../calendar/types';
import type { CalendarEditorRequest } from '../types';

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
  let beforeReplace: (() => Promise<boolean>) | undefined;

  const open = (next: CalendarEditorDraft = {}) => {
    if (draft()) return false;
    setDraft(next);
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
    open,
    close,
    replace,
    registerBeforeReplace,
  };
}
