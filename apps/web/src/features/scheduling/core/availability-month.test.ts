import { describe, expect, it } from 'vitest';
import {
  availabilityDateRange,
  availabilityMonth,
  availabilityMonthRuns,
  availabilityTimeLabel,
  formatAvailabilityTime,
  shiftAvailabilityMonth,
} from './availability-month';

describe('availability month dates', () => {
  it('formats midnight, noon, and exact minutes without changing stored times', () => {
    expect(formatAvailabilityTime('00:05', '12h')).toBe('12:05 AM');
    expect(formatAvailabilityTime('12:00', '12h')).toBe('12:00 PM');
    expect(formatAvailabilityTime('23:55', '12h')).toBe('11:55 PM');
    expect(formatAvailabilityTime('09:05', '24h')).toBe('09:05');
    expect(availabilityTimeLabel({ start: '09:00', end: '17:00' }, '12h')).toBe(
      '9:00 AM–5:00 PM'
    );
    expect(availabilityTimeLabel({ start: '00:00', end: '23:59' }, '12h')).toBe(
      'All day'
    );
  });
  it('builds six Sunday-first rows across leap-month boundaries', () => {
    const dates = availabilityMonth('2024-02-29');
    expect(dates).toHaveLength(42);
    expect(dates[0]).toBe('2024-01-28');
    expect(dates).toContain('2024-02-29');
    expect(dates[41]).toBe('2024-03-09');
    expect(availabilityMonth('2025-02-01')).not.toContain('2025-02-29');
    expect(availabilityMonth('2026-02-30')).toEqual([]);
  });
  it('changes months from the first day without overflowing short months', () => {
    expect(shiftAvailabilityMonth('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftAvailabilityMonth('2026-01-31', -1)).toBe('2025-12-01');
  });
  it('includes reverse-drag endpoints across years and rejects invalid or excessive spans', () => {
    expect(availabilityDateRange('2027-01-02', '2026-12-31')).toEqual([
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
    expect(availabilityDateRange('2026-10-05', '2026-10-05')).toEqual([
      '2026-10-05',
    ]);
    expect(availabilityDateRange('2026-02-30', '2026-03-01')).toEqual([]);
    expect(availabilityDateRange('2026-01-01', '2027-01-03')).toEqual([]);
  });
  it('wraps a reverse-drag preview at week boundaries without spanning unselected cells', () => {
    const dates = availabilityMonth('2026-10-01');
    expect(
      availabilityMonthRuns(
        dates,
        availabilityDateRange('2026-10-13', '2026-10-09')
      )
    ).toEqual([
      { startIndex: 12, dates: ['2026-10-09', '2026-10-10'] },
      { startIndex: 14, dates: ['2026-10-11', '2026-10-12', '2026-10-13'] },
    ]);
    expect(
      availabilityMonthRuns(dates, [
        '2026-10-08',
        '2026-10-05',
        '2026-10-05',
        '2026-10-06',
      ])
    ).toEqual([
      { startIndex: 8, dates: ['2026-10-05', '2026-10-06'] },
      { startIndex: 11, dates: ['2026-10-08'] },
    ]);
  });
  it('clips preview runs to visible dates, including adjacent months', () => {
    const dates = availabilityMonth('2026-10-01');
    expect(
      availabilityMonthRuns(
        dates,
        availabilityDateRange('2026-11-05', '2026-11-10')
      )
    ).toEqual([
      { startIndex: 39, dates: ['2026-11-05', '2026-11-06', '2026-11-07'] },
    ]);
    expect(availabilityMonthRuns(dates, [])).toEqual([]);
  });
});
