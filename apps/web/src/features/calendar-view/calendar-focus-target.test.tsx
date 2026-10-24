/**
 * @vitest-environment jsdom
 */

import { render } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import {
  CalendarFocusContextProvider,
  type CalendarFocusTarget,
  useCalendarFocus,
} from './calendar-focus-target';

vi.mock('@queries/calendar/occurrences', () => ({
  invalidateCalendarOccurrences: vi.fn(),
}));

function focusTarget(requestId: number): CalendarFocusTarget {
  return {
    eventId: 'just-added-copy',
    occurrenceKey: '2026-10-27T21:30:00+00:00',
    date: new Date('2026-10-27T21:30:00Z'),
    requestId,
    requestedAt: Date.now(),
  };
}

function renderFocus(initial: CalendarFocusTarget) {
  const refreshCalendar = vi.fn(async () => {});
  const [target, setTarget] = createSignal(initial);
  let focus!: ReturnType<typeof useCalendarFocus>;
  render(() => (
    <CalendarFocusContextProvider
      target={target}
      refreshCalendar={refreshCalendar}
    >
      {(() => {
        focus = useCalendarFocus();
        return null;
      })()}
    </CalendarFocusContextProvider>
  ));
  return { focus, refreshCalendar, setTarget };
}

describe('calendar focus target', () => {
  it('refreshes the calendar once for an open target the tab does not have yet', () => {
    const { focus, refreshCalendar } = renderFocus(focusTarget(1));

    // The focus effect re-runs on every chip mount while the target is
    // still missing; only the first miss asks for fresh data.
    focus.refreshForMissingTarget(focusTarget(1));
    focus.refreshForMissingTarget(focusTarget(1));

    expect(refreshCalendar).toHaveBeenCalledOnce();
    expect(focus.pendingTarget()?.requestId).toBe(1);
  });

  it('refreshes again for a later open of the same event', () => {
    const { focus, refreshCalendar, setTarget } = renderFocus(focusTarget(1));
    focus.refreshForMissingTarget(focusTarget(1));

    setTarget(focusTarget(2));
    focus.refreshForMissingTarget(focusTarget(2));

    expect(refreshCalendar).toHaveBeenCalledTimes(2);
  });
});
