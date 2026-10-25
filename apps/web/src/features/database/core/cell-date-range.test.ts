import { describe, expect, it } from 'vitest';
import { cellTimeRange, toCellTimeRange } from './cell-date-range';

describe('time-range cells', () => {
  it('reads whole stored days as an all-day range of local days', () => {
    expect(
      cellTimeRange('2026-10-09T00:00:00.000Z/2026-10-13T00:00:00.000Z')
    ).toEqual({
      allDay: true,
      start: new Date(2026, 9, 9),
      end: new Date(2026, 9, 13),
    });
    expect(cellTimeRange('2026-10-09T00:00:00Z/2026-10-13T00:00:00Z')).toEqual({
      allDay: true,
      start: new Date(2026, 9, 9),
      end: new Date(2026, 9, 13),
    });
  });

  it('reads any other instants as a timed range', () => {
    expect(
      cellTimeRange('2026-10-09T13:00:00.000Z/2026-10-13T21:30:00.000Z')
    ).toEqual({
      allDay: false,
      start: new Date('2026-10-09T13:00:00.000Z'),
      end: new Date('2026-10-13T21:30:00.000Z'),
    });
  });

  it('reads nothing from an empty, malformed or backwards cell', () => {
    expect(cellTimeRange(null)).toBeUndefined();
    expect(cellTimeRange('2026-10-09T00:00:00.000Z')).toBeUndefined();
    expect(
      cellTimeRange('2026-10-13T00:00:00.000Z/2026-10-09T00:00:00.000Z')
    ).toBeUndefined();
    expect(
      cellTimeRange('2026-10-13T09:00:00.000Z/2026-10-13T08:00:00.000Z')
    ).toBeUndefined();
  });

  it('stores all-day ranges as UTC midnights and timed ranges as instants', () => {
    expect(
      toCellTimeRange({
        allDay: true,
        start: new Date(2026, 9, 9),
        end: new Date(2026, 9, 13),
      })
    ).toBe('2026-10-09T00:00:00.000Z/2026-10-13T00:00:00.000Z');
    expect(
      toCellTimeRange({
        allDay: false,
        start: new Date('2026-10-09T13:00:00.000Z'),
        end: new Date('2026-10-13T21:30:00.000Z'),
      })
    ).toBe('2026-10-09T13:00:00.000Z/2026-10-13T21:30:00.000Z');
  });
});
