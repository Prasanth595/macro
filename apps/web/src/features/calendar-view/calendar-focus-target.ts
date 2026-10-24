import { createAssertedContextProvider } from '@core/context/createContext';
import { fireAndForget } from '@core/util/fireAndForget';
import { Telemetry } from '@macro-inc/observability';
import { invalidateCalendarOccurrences } from '@queries/calendar/occurrences';
import { type Accessor, createSignal, type ParentProps } from 'solid-js';

const FOCUS_TARGET_TTL_MS = 15_000;

/** A request for one calendar view instance to focus a rendered occurrence. */
export interface CalendarFocusTarget {
  /** Canonical calendar event entity id. */
  eventId: string;
  /** Stable occurrence key within the event. */
  occurrenceKey: string;
  /** Occurrence start, used to page the calendar to the right date. */
  date: Date;
  /** Monotonic id that allows the same target to be requested repeatedly. */
  requestId: number;
  /** Time the navigation was requested, used to reject delayed focus. */
  requestedAt: number;
}

/** The grid's composite view-model id for a focus target. */
export function calendarFocusTargetId(target: CalendarFocusTarget): string {
  return JSON.stringify([target.eventId, target.occurrenceKey]);
}

interface CalendarFocusContextProps extends ParentProps {
  target?: Accessor<CalendarFocusTarget | undefined>;
  /** Brings the calendar data forward; a delta sync and refetch by default. */
  refreshCalendar?: () => Promise<unknown>;
}

/** Instance-scoped focus state for one mounted calendar workspace. */
export const [CalendarFocusContextProvider, useCalendarFocus] =
  createAssertedContextProvider(
    'CalendarFocusContext',
    (props: CalendarFocusContextProps) => {
      const [consumedRequestId, setConsumedRequestId] = createSignal<number>();
      let refreshedRequestId: number | undefined;
      return {
        pendingTarget: () => {
          const target = props.target?.();
          if (
            !target ||
            target.requestId === consumedRequestId() ||
            Date.now() - target.requestedAt > FOCUS_TARGET_TTL_MS
          ) {
            return undefined;
          }
          return target;
        },
        consume: (requestId: number) => setConsumedRequestId(requestId),
        /**
         * The tab's calendar data can predate the target: a copy just added
         * from a shared-event card while no calendar was open reaches it only
         * on a later sync, after the request has expired. Refresh once per
         * request so the target can still arrive in time.
         */
        refreshForMissingTarget: (target: CalendarFocusTarget) => {
          if (refreshedRequestId === target.requestId) return;
          refreshedRequestId = target.requestId;
          const refresh =
            props.refreshCalendar ?? invalidateCalendarOccurrences;
          fireAndForget(
            Telemetry.span('calendar.focus_target_refresh', async (span) => {
              span.setAttr('calendar.event_id', target.eventId);
              await refresh();
            }),
            'calendar-focus'
          );
        },
      };
    }
  );
