import { describe, expect, it } from 'vitest';
import {
  BOOKING_RANGE_TIMELINE,
  bookingTimelinePosition,
  bookingTimelineValue,
} from './booking-rule-timeline';

describe('booking range display scale', () => {
  it('places labelled common values at the scale landmarks', () => {
    expect(
      BOOKING_RANGE_TIMELINE.map((value) =>
        bookingTimelinePosition(value, BOOKING_RANGE_TIMELINE)
      )
    ).toEqual([0, 25, 50, 75, 100]);
  });

  it('pins large values without changing the exact source value', () => {
    for (const days of [30, 60, 365]) {
      const exactMinutes = days * 1440;
      expect(
        bookingTimelinePosition(exactMinutes, BOOKING_RANGE_TIMELINE)
      ).toBe(100);
      expect(exactMinutes).toBe(days * 1440);
    }
  });

  it('round trips every supported notice minute and every displayed horizon day', () => {
    for (let value = 0; value <= 10080; value++) {
      expect(
        bookingTimelineValue(
          bookingTimelinePosition(value, BOOKING_RANGE_TIMELINE),
          BOOKING_RANGE_TIMELINE
        )
      ).toBe(value);
    }
    for (let day = 1; day <= 30; day++) {
      const value = day * 1440;
      expect(
        bookingTimelineValue(
          bookingTimelinePosition(value, BOOKING_RANGE_TIMELINE),
          BOOKING_RANGE_TIMELINE
        )
      ).toBe(value);
    }
  });
});
