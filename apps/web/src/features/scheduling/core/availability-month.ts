import { dateWeekday, validAvailabilityDate } from './availability';
import { shiftReportDate } from './insights';
import type { TimeWindow } from './types';

export type AvailabilityTimeFormat = '12h' | '24h';

/** Six Sunday-first rows, including adjacent-month days. */
export function availabilityMonth(date: string): string[] {
  if (!validAvailabilityDate(date)) return [];
  const first = `${date.slice(0, 7)}-01`;
  const start = shiftReportDate(first, -dateWeekday(first));
  return Array.from({ length: 42 }, (_, index) =>
    shiftReportDate(start, index)
  );
}

export function shiftAvailabilityMonth(date: string, offset: number): string {
  const value = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + offset);
  return value.toISOString().slice(0, 10);
}

/** A date drag includes both endpoints, regardless of direction. */
export function availabilityDateRange(anchor: string, end: string): string[] {
  if (!validAvailabilityDate(anchor) || !validAvailabilityDate(end)) return [];
  const first = anchor < end ? anchor : end;
  const last = anchor < end ? end : anchor;
  const count = (Date.parse(last) - Date.parse(first)) / 86400000 + 1;
  if (count > 366) return [];
  return Array.from({ length: count }, (_, index) =>
    shiftReportDate(first, index)
  );
}

export type AvailabilityMonthRun = { startIndex: number; dates: string[] };

/** Join selected neighbors, breaking at gaps and Sunday-first week boundaries. */
export function availabilityMonthRuns(
  dates: string[],
  selectedDates: string[]
): AvailabilityMonthRun[] {
  const selected = new Set(selectedDates);
  const runs: AvailabilityMonthRun[] = [];
  let current: AvailabilityMonthRun | undefined;
  for (const [index, date] of dates.entries()) {
    if (!selected.has(date)) {
      current = undefined;
      continue;
    }
    if (!current || index % 7 === 0) {
      current = { startIndex: index, dates: [] };
      runs.push(current);
    }
    current.dates.push(date);
  }
  return runs;
}

export function formatAvailabilityTime(
  time: string,
  format: AvailabilityTimeFormat
): string {
  if (format === '24h') return time;
  const [hours, minutes] = time.split(':');
  const hour = Number(hours);
  return `${hour % 12 || 12}:${minutes} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function availabilityTimeLabel(
  window: TimeWindow,
  format: AvailabilityTimeFormat
): string {
  if (window.start === '00:00' && window.end === '23:59') return 'All day';
  return `${formatAvailabilityTime(window.start, format)}–${formatAvailabilityTime(window.end, format)}`;
}
