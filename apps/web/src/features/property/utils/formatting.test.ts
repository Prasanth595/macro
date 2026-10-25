import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatTimeRange,
  formatTimeRangeDuration,
} from './formatting';

describe('formatDate', () => {
  it('shows a day as its short month, day and year', () => {
    expect(formatDate(new Date(2025, 2, 14))).toBe('Mar 14, 2025');
    expect(formatDate(new Date(2026, 11, 1, 23, 59))).toBe('Dec 1, 2026');
  });
});

describe('formatTimeRange', () => {
  it('shows an all-day range as its days, sharing the month and year', () => {
    expect(
      formatTimeRange({
        allDay: true,
        start: new Date(2026, 9, 9),
        end: new Date(2026, 9, 13),
      })
    ).toBe('Oct 9\u2009–\u200913, 2026');
    expect(
      formatTimeRange({
        allDay: true,
        start: new Date(2026, 9, 9),
        end: new Date(2026, 9, 9),
      })
    ).toBe('Oct 9, 2026');
  });

  it('shows a timed range on one day as the day and both times', () => {
    expect(
      formatTimeRange({
        allDay: false,
        start: new Date(2026, 9, 9, 9),
        end: new Date(2026, 9, 9, 17),
      })
    ).toBe('Oct 9, 9:00\u202fAM\u2009–\u20095:00\u202fPM');
  });

  it('shows a timed range over days as each day with its time', () => {
    expect(
      formatTimeRange({
        allDay: false,
        start: new Date(2026, 9, 9, 9),
        end: new Date(2026, 9, 13, 17),
      })
    ).toBe('Oct 9, 9:00\u202fAM\u2009–\u2009Oct 13, 5:00\u202fPM');
  });
});

describe('formatTimeRangeDuration', () => {
  it('counts an all-day range’s days, both ends included', () => {
    expect(
      formatTimeRangeDuration({
        allDay: true,
        start: new Date(2026, 9, 9),
        end: new Date(2026, 9, 13),
      })
    ).toBe('5 days');
    expect(
      formatTimeRangeDuration({
        allDay: true,
        start: new Date(2026, 9, 9),
        end: new Date(2026, 9, 9),
      })
    ).toBe('1 day');
  });

  it('counts a timed range’s days, hours and minutes', () => {
    expect(
      formatTimeRangeDuration({
        allDay: false,
        start: new Date(2026, 9, 9, 9),
        end: new Date(2026, 9, 13, 17),
      })
    ).toBe('4 days 8 hrs');
    expect(
      formatTimeRangeDuration({
        allDay: false,
        start: new Date(2026, 9, 9, 9),
        end: new Date(2026, 9, 9, 17),
      })
    ).toBe('8 hrs');
    expect(
      formatTimeRangeDuration({
        allDay: false,
        start: new Date(2026, 9, 9, 9),
        end: new Date(2026, 9, 9, 10, 30),
      })
    ).toBe('1 hr 30 mins');
    expect(
      formatTimeRangeDuration({
        allDay: false,
        start: new Date(2026, 9, 9, 9),
        end: new Date(2026, 9, 9, 9),
      })
    ).toBe('0 mins');
  });

  it('counts a day across a daylight-saving change as one day', () => {
    expect(
      formatTimeRangeDuration({
        allDay: false,
        start: new Date(2026, 10, 1, 0, 30),
        end: new Date(2026, 10, 2, 0, 30),
      })
    ).toBe('1 day');
  });
});
