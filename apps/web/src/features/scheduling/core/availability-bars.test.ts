import { describe, expect, it } from 'vitest';
import type { AvailabilityChange } from './availability';
import { availabilityBars, movedAvailabilityWindow } from './availability-bars';
import type { TimeWindow } from './types';

const window = (start: string, end: string): TimeWindow => ({ start, end });
const draft = (
  mode: AvailabilityChange['mode'],
  range: TimeWindow
): AvailabilityChange => ({
  target: { kind: 'date', date: '2026-10-05' },
  mode,
  window: range,
});

describe('availability bar previews', () => {
  it('extends touching or overlapping available hours as one bar without hatching', () => {
    const available = [window('09:00', '17:00')];
    for (const start of ['16:00', '17:00']) {
      const bars = availabilityBars(
        available,
        [],
        draft('available', window(start, '18:00'))
      );
      expect(bars.available).toEqual([
        {
          window: window('09:00', '18:00'),
          draft: true,
          index: undefined,
          overlaps: [],
        },
      ]);
      expect(bars.unavailable).toEqual([]);
    }
    expect(available).toEqual([window('09:00', '17:00')]);
  });

  it('merges unavailable extensions and marks only their newly conflicting available hours', () => {
    const bars = availabilityBars(
      [window('09:00', '12:00'), window('13:00', '17:00')],
      [window('12:00', '13:00')],
      draft('unavailable', window('12:30', '14:00'))
    );
    expect(bars.unavailable).toEqual([
      {
        window: window('12:00', '14:00'),
        draft: true,
        index: undefined,
        overlaps: [window('13:00', '14:00')],
      },
    ]);
    expect(bars.available[0].overlaps).toEqual([]);
    expect(bars.available[1].overlaps).toEqual([window('13:00', '14:00')]);
  });

  it('replaces the edited available origin before merging and preserves separate siblings', () => {
    const bars = availabilityBars(
      [window('09:00', '12:00'), window('13:00', '17:00')],
      [],
      {
        ...draft('available', window('10:00', '11:00')),
        index: 0,
        origin: { mode: 'available', window: window('09:00', '12:00') },
      }
    );
    expect(bars.available.map((bar) => bar.window)).toEqual([
      window('10:00', '11:00'),
      window('13:00', '17:00'),
    ]);
    expect(bars.available[1].index).toBe(1);
  });

  it('restores old time off when shrinking its preview without hatching against itself', () => {
    const bars = availabilityBars(
      [window('09:00', '12:00'), window('13:00', '17:00')],
      [window('12:00', '13:00')],
      {
        ...draft('unavailable', window('12:15', '12:45')),
        origin: { mode: 'unavailable', window: window('12:00', '13:00') },
      }
    );
    expect(bars.available.map((bar) => bar.window)).toEqual([
      window('09:00', '12:15'),
      window('12:45', '17:00'),
    ]);
    expect(bars.unavailable).toEqual([
      {
        window: window('12:15', '12:45'),
        draft: true,
        index: undefined,
        overlaps: [],
      },
    ]);
  });

  it('replaces selected time off with available hours without retaining or hatching against its origin', () => {
    const available = [window('09:00', '12:00'), window('13:00', '17:00')];
    const unavailable = [window('12:00', '13:00')];
    const bars = availabilityBars(available, unavailable, {
      ...draft('available', window('12:00', '13:00')),
      origin: { mode: 'unavailable', window: unavailable[0] },
    });
    expect(bars.available.map((bar) => bar.window)).toEqual([
      window('09:00', '17:00'),
    ]);
    expect(bars.available[0].overlaps).toEqual([]);
    expect(bars.unavailable).toEqual([]);
    expect(unavailable).toEqual([window('12:00', '13:00')]);
  });

  it('retains unconverted portions of the origin and still marks sibling time-off conflicts', () => {
    const available = [
      window('09:00', '12:00'),
      window('13:00', '14:00'),
      window('15:00', '17:00'),
    ];
    const unavailable = [window('12:00', '13:00'), window('14:00', '15:00')];
    const origin = { mode: 'unavailable' as const, window: unavailable[0] };
    const partial = availabilityBars(available, unavailable, {
      ...draft('available', window('12:15', '12:45')),
      origin,
    });
    expect(partial.unavailable.map((bar) => bar.window)).toEqual([
      window('12:00', '12:15'),
      window('12:45', '13:00'),
      window('14:00', '15:00'),
    ]);
    expect(
      [...partial.available, ...partial.unavailable].every(
        (bar) => !bar.overlaps.length
      )
    ).toBe(true);
    const extended = availabilityBars(available, unavailable, {
      ...draft('available', window('12:00', '14:30')),
      origin,
    });
    expect(extended.unavailable).toEqual([
      {
        window: unavailable[1],
        index: undefined,
        draft: false,
        overlaps: [window('14:00', '14:30')],
      },
    ]);
    expect(extended.available[0].overlaps).toEqual([window('14:00', '14:30')]);
  });
  it('keeps saved opposite-type ranges disjoint and excludes disabled remembered hours from conflicts', () => {
    const available = [window('09:00', '12:00'), window('13:00', '17:00')];
    const unavailable = [window('12:00', '13:00')];
    const saved = availabilityBars(available, unavailable);
    expect(
      [...saved.available, ...saved.unavailable].every(
        (bar) => !bar.overlaps.length
      )
    ).toBe(true);
    const inactive = availabilityBars(
      [window('09:00', '17:00')],
      [],
      draft('unavailable', window('12:00', '13:00')),
      false
    );
    expect(inactive.unavailable[0].overlaps).toEqual([]);
    const activeDate = availabilityBars(
      available,
      unavailable,
      draft('unavailable', window('11:00', '12:30')),
      true
    );
    expect(activeDate.unavailable[0].overlaps).toEqual([
      window('11:00', '12:00'),
    ]);
  });
});

describe('moving availability windows', () => {
  it('snaps the start to 5 minutes while preserving duration and input', () => {
    const range = window('09:05', '10:10');
    expect(movedAvailabilityWindow(range, 20)).toEqual(
      window('09:25', '10:30')
    );
    expect(movedAvailabilityWindow(range, 17)).toEqual(
      window('09:20', '10:25')
    );
    expect(range).toEqual(window('09:05', '10:10'));
  });

  it('clamps both day edges without shortening the range', () => {
    const range = window('09:00', '17:00');
    expect(movedAvailabilityWindow(range, -900)).toEqual(
      window('00:00', '08:00')
    );
    expect(movedAvailabilityWindow(range, 900)).toEqual(
      window('15:59', '23:59')
    );
    expect(movedAvailabilityWindow(window('00:00', '23:59'), 60)).toEqual(
      window('00:00', '23:59')
    );
  });
});
