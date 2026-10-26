import type { CalendarOccurrenceQueryRange } from '@queries/calendar/occurrences';
import type { EventEditorInitialValues } from '../calendar/components/composer/event-form-model';
import type { CalendarEvent } from '../calendar/types';

/** Stable identity used by the Calendar application view. */
export const CALENDAR_VIEW_ID = 'calendar';

export interface CalendarEditorRequest {
  id: string;
  event?: CalendarEvent;
  initialValues?: EventEditorInitialValues;
  onCalendarChange?: (calendarId: string, color: string) => void;
  onClose?: () => void;
  /** Returns true once, even if the same request reaches a remounted workspace. */
  consume: () => boolean;
}
/** Optional navigation target carried by an in-app Calendar route entry. */
export interface CalendarViewTarget {
  /** Canonical event to focus. */
  eventId?: string;
  /** Exact half-open occurrence API range used to locate `eventId`. */
  range?: CalendarOccurrenceQueryRange;
  /** Stable occurrence key, when the target is a recurring event instance. */
  occurrenceKey?: string;
  /** Monotonic token that makes repeated navigation to one event observable. */
  focusRequestId?: number;
  /** Ephemeral create/edit action consumed by the calendar-owned editor. */
  editorRequest?: CalendarEditorRequest;
}

/** A validated request to locate and focus one event occurrence. */
export interface CalendarFocusRequest {
  eventId: string;
  range: CalendarOccurrenceQueryRange;
  occurrenceKey?: string;
  requestId: number;
  requestedAt: number;
}
