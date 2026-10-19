import type { EventEditorInitialValues } from '@app/features/calendar/components/composer/event-form-model';
import type { CalendarEvent } from '@app/features/calendar/types';
import { openCalendarView } from '../calendar-navigation';
import { createCalendarEditorRequest } from '../primitives/create-calendar-editor';

/** Values and lifecycle callbacks used to open an event composer. */
export interface OpenEventComposerOptions {
  event?: CalendarEvent;
  initialValues?: EventEditorInitialValues;
  onCalendarChange?: (calendarId: string, color: string) => void;
  onClose?: () => void;
}

/** Calendar owns both creation and editing, including their persistent surfaces. */
export function useOpenEventComposer() {
  return (options: OpenEventComposerOptions = {}) => {
    openCalendarView({
      editorRequest: createCalendarEditorRequest(options),
    });
  };
}
