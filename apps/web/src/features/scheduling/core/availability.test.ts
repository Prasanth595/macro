import { describe, expect, it } from 'vitest';
import {
  type AvailabilityChange,
  applyAvailabilityChange,
  availabilityConflictIssue,
  availabilityConflicts,
  availabilityScheduleIssue,
  availabilityWeek,
  calendarUnavailableWindows,
  copyAvailability,
  drawnWindow,
  mergeWindows,
  rangeOverlaps,
  subtractWindows,
  targetWindows,
  unavailableWindows,
  validAvailabilityDate,
  windowsIssue,
} from './availability';
import { newSchedule, type TimeWindow } from './types';

const window = (start: string, end: string): TimeWindow => ({ start, end });
const schedule = () => newSchedule('America/New_York');
const date = '2026-10-05';
const dateChange = (
  mode: AvailabilityChange['mode'],
  range = window('12:00', '13:00')
): AvailabilityChange => ({
  target: { kind: 'date', date },
  mode,
  window: range,
});

describe('availability drawing and validation', () => {
  it('snaps reverse drags and clamps selections at both day boundaries', () => {
    expect(drawnWindow(735, 606)).toEqual(window('10:05', '12:20'));
    expect(drawnWindow(606, 618)).toEqual(window('10:05', '10:20'));
    expect(drawnWindow(-20, -1)).toEqual(window('00:00', '00:05'));
    expect(drawnWindow(1440, 1500)).toEqual(window('23:55', '23:59'));
    expect(drawnWindow(600, 600)).toEqual(window('10:00', '10:05'));
  });

  it('rejects malformed and overnight hours but permits adjacent ranges', () => {
    for (const range of [
      window('', '11:00'),
      window('25:00', '26:00'),
      window('09:00', '09:00'),
      window('23:00', '01:00'),
    ])
      expect(windowsIssue([range])?.mergeable).toBe(false);
    expect(
      windowsIssue([window('09:00', '12:00'), window('12:00', '17:00')])
    ).toBeUndefined();
    expect(
      windowsIssue([window('13:00', '17:00'), window('09:00', '14:00')])
        ?.mergeable
    ).toBe(true);
  });

  it('validates real calendar dates and spans month boundaries without timezone shifts', () => {
    expect(validAvailabilityDate('2026-02-30')).toBe(false);
    expect(validAvailabilityDate('2024-02-29')).toBe(true);
    expect(validAvailabilityDate('')).toBe(false);
    expect(availabilityWeek('2026-11-01')).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ]);
    expect(availabilityWeek('2026-12-01')).toEqual([
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
      '2026-12-05',
    ]);
    expect(availabilityWeek('2026-12-05')).toEqual(
      availabilityWeek('2026-12-01')
    );
  });

  it('enforces backend day, name, and range limits before saving', () => {
    const current = schedule();
    expect(
      availabilityScheduleIssue({ ...current, name: 'a'.repeat(101) })
    ).toContain('100');
    expect(
      availabilityScheduleIssue({ ...current, weekly: current.weekly.slice(1) })
    ).toContain('weekday');
    expect(
      availabilityScheduleIssue({
        ...current,
        overrides: [{ date: '2026-02-30', windows: [] }],
      })
    ).toContain('valid date');
    expect(
      windowsIssue(
        Array.from({ length: 9 }, (_, hour) =>
          window(`0${hour}:00`, `0${hour}:30`)
        )
      )?.message
    ).toContain('eight');
  });
});

describe('availability overlap fixes and copy', () => {
  it.each([
    ['16:00', '18:00', '18:00'],
    ['17:00', '18:00', '18:00'],
    ['10:00', '11:00', '17:00'],
  ])(
    'automatically merges matching hours %s–%s without mutation',
    (start, end, mergedEnd) => {
      const current = schedule();
      const change: AvailabilityChange = {
        target: { kind: 'weekly', day: 1 },
        mode: 'available',
        window: window(start, end),
      };
      const result = applyAvailabilityChange(current, change);
      expect(result.ok).toBe(true);
      if (result.ok)
        expect(targetWindows(result.schedule, change.target)).toEqual([
          window('09:00', mergedEnd),
        ]);
      expect(targetWindows(current, change.target)).toEqual([
        window('09:00', '17:00'),
      ]);
    }
  );

  it('rejects stale edit indexes and malformed hours even with merge approval', () => {
    const current = schedule();
    const change: AvailabilityChange = {
      target: { kind: 'weekly', day: 1 },
      mode: 'available',
      window: window('10:00', '11:00'),
      index: 2,
    };
    expect(applyAvailabilityChange(current, change)).toMatchObject({
      ok: false,
    });
    expect(
      applyAvailabilityChange(
        current,
        { ...change, index: undefined, window: window('bad', '12:00') },
        true
      )
    ).toMatchObject({ ok: false, issue: { mergeable: false } });
  });

  it('rejects opposite-type copying atomically, then replaces only with approval', () => {
    const current = schedule();
    const targets = [
      { kind: 'date' as const, date: '2026-10-10' },
      { kind: 'date' as const, date: '2026-10-06' },
    ];
    current.overrides = [{ date: targets[1].date, windows: [] }];
    const change = dateChange('available');
    expect(copyAvailability(current, change, targets)).toMatchObject({
      ok: false,
      issue: { overlaps: [change.window] },
    });
    expect(targetWindows(current, targets[0])).toEqual([]);
    expect(current.overrides).toHaveLength(1);
    const result = copyAvailability(current, change, targets, true);
    expect(result.ok).toBe(true);
    if (result.ok)
      for (const target of targets)
        expect(targetWindows(result.schedule, target)).toEqual([change.window]);
  });

  it('merges nested and adjacent ranges without mutating the input', () => {
    const input = [
      window('13:00', '17:00'),
      window('09:00', '14:00'),
      window('10:00', '11:00'),
      window('17:00', '18:00'),
    ];
    expect(mergeWindows(input)).toEqual([window('09:00', '18:00')]);
    expect(input[0]).toEqual(window('13:00', '17:00'));
  });
});

describe('range overlaps', () => {
  it('clips overlaps from either side regardless of comparison order', () => {
    expect(
      rangeOverlaps(window('10:00', '16:00'), [
        window('15:00', '18:00'),
        window('08:00', '11:00'),
      ])
    ).toEqual([window('10:00', '11:00'), window('15:00', '16:00')]);
  });

  it('excludes adjacent windows with touching boundaries', () => {
    expect(
      rangeOverlaps(window('10:00', '12:00'), [
        window('09:00', '10:00'),
        window('12:00', '13:00'),
      ])
    ).toEqual([]);
  });

  it('keeps nested overlaps and merges touching or overlapping intersections', () => {
    expect(
      rangeOverlaps(window('10:00', '17:00'), [
        window('14:00', '16:00'),
        window('09:00', '12:00'),
        window('11:00', '12:00'),
        window('16:00', '18:00'),
        window('13:00', '14:00'),
      ])
    ).toEqual([window('10:00', '12:00'), window('13:00', '17:00')]);
    expect(
      rangeOverlaps(window('10:00', '17:00'), [window('12:00', '13:00')])
    ).toEqual([window('12:00', '13:00')]);
  });

  it('returns no intersections for invalid ranges and ignores invalid windows', () => {
    const windows = [
      window('09:00', '11:00'),
      window('16:00', '14:00'),
      window('bad', '12:00'),
      window('10:00', '25:00'),
    ];
    for (const range of [
      window('12:00', '10:00'),
      window('10:00', '10:00'),
      window('bad', '17:00'),
      window('10:00', '24:00'),
    ])
      expect(rangeOverlaps(range, windows)).toEqual([]);
    expect(rangeOverlaps(window('10:00', '17:00'), windows)).toEqual([
      window('10:00', '11:00'),
    ]);
  });

  it('does not mutate either input or return their window objects', () => {
    const range = Object.freeze(window('10:00', '17:00'));
    const first = Object.freeze(window('14:00', '18:00'));
    const second = Object.freeze(window('09:00', '15:00'));
    const windows: readonly TimeWindow[] = Object.freeze([first, second]);
    const overlaps = rangeOverlaps(range, windows);
    expect(overlaps).toEqual([window('10:00', '17:00')]);
    expect(overlaps[0]).not.toBe(range);
    expect(overlaps[0]).not.toBe(first);
    expect(overlaps[0]).not.toBe(second);
    expect(windows).toEqual([
      window('14:00', '18:00'),
      window('09:00', '15:00'),
    ]);
  });
});

describe('all-day availability', () => {
  it.each([
    { kind: 'date' as const, date },
    { kind: 'weekly' as const, day: 6 },
  ])(
    'stores valid full-day hours for $kind without using hidden time fields',
    (target) => {
      const change: AvailabilityChange = {
        target,
        mode: 'available',
        allDay: true,
        window: window('', ''),
      };
      const result = applyAvailabilityChange(schedule(), change);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(targetWindows(result.schedule, target)).toEqual([
          window('00:00', '23:59'),
        ]);
        expect(availabilityScheduleIssue(result.schedule)).toBeUndefined();
      }
      expect(change.window).toEqual(window('', ''));
    }
  );

  it('automatically joins sibling available ranges when expanding an edit to all day', () => {
    const current = schedule();
    current.weekly[1].windows = [
      window('09:00', '12:00'),
      window('13:00', '17:00'),
    ];
    const change: AvailabilityChange = {
      target: { kind: 'weekly', day: 1 },
      mode: 'available',
      allDay: true,
      index: 0,
      window: window('09:00', '12:00'),
    };
    const result = applyAvailabilityChange(current, change);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(targetWindows(result.schedule, change.target)).toEqual([
        window('00:00', '23:59'),
      ]);
    expect(current.weekly[1].windows).toHaveLength(2);
  });
});

describe('date override compatibility', () => {
  it('edits one inherited date range without dropping sibling ranges or changing weekly hours', () => {
    const current = schedule();
    current.weekly[1].windows = [
      window('09:00', '12:00'),
      window('13:00', '17:00'),
    ];
    const change = {
      ...dateChange('available', window('10:00', '12:00')),
      index: 0,
    };
    const result = applyAvailabilityChange(current, change);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(targetWindows(result.schedule, change.target)).toEqual([
        window('10:00', '12:00'),
        window('13:00', '17:00'),
      ]);
      expect(result.schedule.weekly).toEqual(current.weekly);
    }
    expect(current.overrides).toEqual([]);
    const joined = applyAvailabilityChange(current, {
      ...change,
      window: window('10:00', '14:00'),
    });
    expect(joined.ok).toBe(true);
    if (joined.ok)
      expect(targetWindows(joined.schedule, change.target)).toEqual([
        window('10:00', '17:00'),
      ]);
  });

  it('copies to an untouched date without discarding inherited weekly hours', () => {
    const current = schedule();
    const target = { kind: 'date' as const, date: '2026-10-06' };
    const result = copyAvailability(
      current,
      dateChange('available', window('18:00', '19:00')),
      [target]
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(targetWindows(result.schedule, target)).toEqual([
        window('09:00', '17:00'),
        window('18:00', '19:00'),
      ]);
    expect(current.overrides).toEqual([]);
  });

  it('merges copied inherited hours automatically and respects existing time off', () => {
    const current = schedule();
    const targets = [
      { kind: 'date' as const, date: '2026-10-10' },
      { kind: 'date' as const, date: '2026-10-06' },
    ];
    const change = dateChange('available', window('10:00', '11:00'));
    const merged = copyAvailability(current, change, targets);
    expect(merged.ok).toBe(true);
    if (merged.ok) {
      expect(targetWindows(merged.schedule, targets[0])).toEqual([
        change.window,
      ]);
      expect(targetWindows(merged.schedule, targets[1])).toEqual([
        window('09:00', '17:00'),
      ]);
    }
    current.overrides = [{ date: targets[1].date, windows: [] }];
    expect(copyAvailability(current, change, [targets[1]])).toMatchObject({
      ok: false,
      issue: { overlaps: [change.window] },
    });
    const closed = copyAvailability(current, change, [targets[1]], true);
    expect(closed.ok).toBe(true);
    if (closed.ok)
      expect(targetWindows(closed.schedule, targets[1])).toEqual([
        change.window,
      ]);
  });
  it('shows time off outside weekly hours after editing a custom override', () => {
    const current = schedule();
    current.overrides = [{ date, windows: [window('18:00', '21:00')] }];
    const result = applyAvailabilityChange(
      current,
      dateChange('unavailable', window('20:00', '21:00')),
      true
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(targetWindows(result.schedule, { kind: 'date', date })).toEqual([
        window('18:00', '20:00'),
      ]);
      expect(unavailableWindows(result.schedule, date)).toEqual([
        window('00:00', '18:00'),
        window('20:00', '23:59'),
      ]);
    }
  });
  it('subtracts partial time off, preserves remaining hours, and derives the blocked card', () => {
    const current = schedule();
    const result = applyAvailabilityChange(
      current,
      dateChange('unavailable'),
      true
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(targetWindows(result.schedule, { kind: 'date', date })).toEqual([
        window('09:00', '12:00'),
        window('13:00', '17:00'),
      ]);
      expect(unavailableWindows(result.schedule, date)).toEqual([
        window('00:00', '09:00'),
        window('12:00', '13:00'),
        window('17:00', '23:59'),
      ]);
      expect(result.schedule.weekly).toEqual(current.weekly);
      expect(result.schedule.overrides).toHaveLength(1);
    }
  });

  it('represents all-day time off with an empty override and never falls back to weekly hours', () => {
    const result = applyAvailabilityChange(
      schedule(),
      {
        ...dateChange('unavailable'),
        allDay: true,
      },
      true
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(targetWindows(result.schedule, { kind: 'date', date })).toEqual(
        []
      );
      expect(unavailableWindows(result.schedule, date)).toEqual([
        window('00:00', '23:59'),
      ]);
    }
  });

  it('shows only a dragged midday cut on the calendar and keeps full-day booking gaps', () => {
    const result = applyAvailabilityChange(
      schedule(),
      dateChange('unavailable'),
      true
    );
    if (!result.ok) throw new Error('Expected a valid midday cut');
    expect(calendarUnavailableWindows(result.schedule, date)).toEqual([
      window('12:00', '13:00'),
    ]);
    expect(unavailableWindows(result.schedule, date)).toEqual([
      window('00:00', '09:00'),
      window('12:00', '13:00'),
      window('17:00', '23:59'),
    ]);
    expect(calendarUnavailableWindows(schedule(), date)).toEqual([]);
  });

  it('does not invent time-off bars between separate available additions', () => {
    const current = schedule();
    const target = { kind: 'date' as const, date };
    const added = applyAvailabilityChange(current, {
      target,
      mode: 'available',
      window: window('18:00', '19:00'),
    });
    if (!added.ok) throw new Error('Expected available hours');
    expect(calendarUnavailableWindows(added.schedule, date)).toEqual([]);
    expect(unavailableWindows(added.schedule, date)).toContainEqual(
      window('17:00', '18:00')
    );
    current.weekly[1].windows = [];
    current.overrides = [
      {
        date,
        windows: [window('18:00', '19:00'), window('20:00', '21:00')],
      },
    ];
    expect(calendarUnavailableWindows(current, date)).toEqual([]);
    expect(
      calendarUnavailableWindows(current, date, [window('18:00', '21:00')])
    ).toEqual([window('19:00', '20:00')]);
  });

  it('clips custom-range edge cuts using previous hours without painting implicit off-hours', () => {
    const current = schedule();
    current.overrides = [
      { date, windows: [window('08:00', '12:00'), window('14:00', '20:00')] },
    ];
    const result = applyAvailabilityChange(
      current,
      dateChange('unavailable', window('08:00', '09:00')),
      true
    );
    if (!result.ok) throw new Error('Expected a valid edge cut');
    const next = applyAvailabilityChange(
      result.schedule,
      dateChange('unavailable', window('19:00', '20:00')),
      true
    );
    if (!next.ok) throw new Error('Expected a valid edge cut');
    expect(calendarUnavailableWindows(next.schedule, date)).toEqual([
      window('12:00', '14:00'),
    ]);
    expect(
      calendarUnavailableWindows(
        next.schedule,
        date,
        current.overrides[0].windows
      )
    ).toEqual([
      window('08:00', '09:00'),
      window('12:00', '14:00'),
      window('19:00', '20:00'),
    ]);
  });

  it('shows an empty override as all-day time off even without recurring hours', () => {
    const current = schedule();
    current.weekly[1].windows = [];
    current.overrides = [{ date, windows: [] }];
    expect(calendarUnavailableWindows(current, date)).toEqual([
      window('00:00', '23:59'),
    ]);
  });

  it('extends inherited dated availability and merges connected additions', () => {
    const first = applyAvailabilityChange(
      schedule(),
      dateChange('available', window('16:00', '18:00'))
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(targetWindows(first.schedule, { kind: 'date', date })).toEqual([
      window('09:00', '18:00'),
    ]);
    const second = applyAvailabilityChange(
      first.schedule,
      dateChange('available', window('18:00', '19:00'))
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(targetWindows(second.schedule, { kind: 'date', date })).toEqual([
        window('09:00', '19:00'),
      ]);
      expect(second.schedule.overrides).toHaveLength(1);
    }
  });

  it('cuts across multiple ranges and rejects time off that changes nothing', () => {
    expect(
      subtractWindows(
        [window('09:00', '11:00'), window('13:00', '17:00')],
        window('10:00', '14:00')
      )
    ).toEqual([window('09:00', '10:00'), window('14:00', '17:00')]);
    expect(
      applyAvailabilityChange(
        schedule(),
        dateChange('unavailable', window('19:00', '20:00'))
      )
    ).toMatchObject({ ok: false });
  });

  it('rejects cuts that exceed eight ranges and excess new overrides', () => {
    const current = schedule();
    current.overrides = [
      {
        date,
        windows: Array.from({ length: 8 }, (_, hour) =>
          window(
            `${String(hour + 8).padStart(2, '0')}:00`,
            `${String(hour + 8).padStart(2, '0')}:45`
          )
        ),
      },
    ];
    expect(
      applyAvailabilityChange(
        current,
        dateChange('unavailable', window('10:15', '10:30'))
      )
    ).toMatchObject({ ok: false, issue: { mergeable: false } });
    current.overrides = Array.from({ length: 366 }, (_, index) => ({
      date: `existing-${index}`,
      windows: [],
    }));
    expect(
      applyAvailabilityChange(current, {
        ...dateChange('unavailable'),
        allDay: true,
      })
    ).toMatchObject({ ok: false });
  });
});

describe('opposite availability conflicts and edit origins', () => {
  const splitSchedule = () => {
    const current = schedule();
    current.overrides = [
      { date, windows: [window('09:00', '12:00'), window('13:00', '17:00')] },
    ];
    return current;
  };

  it('warns only for opposite-type intersections and leaves touching boundaries clear', () => {
    const current = splitSchedule();
    expect(
      availabilityConflicts(
        current,
        dateChange('available', window('10:00', '14:00'))
      )
    ).toEqual([window('12:00', '13:00')]);
    expect(
      availabilityConflicts(
        current,
        dateChange('unavailable', window('10:00', '14:00'))
      )
    ).toEqual([window('10:00', '12:00'), window('13:00', '14:00')]);
    expect(
      availabilityConflicts(
        current,
        dateChange('available', window('11:00', '12:00'))
      )
    ).toEqual([]);
    expect(
      availabilityConflicts(
        current,
        dateChange('available', window('17:00', '18:00'))
      )
    ).toEqual([]);
    expect(
      availabilityConflictIssue(
        current,
        dateChange('available', window('11:00', '14:00'))
      )?.overlaps
    ).toEqual([window('12:00', '13:00')]);
  });

  it('requires explicit opposite replacement without mutating the schedule, then merges available neighbors', () => {
    const current = splitSchedule();
    const change = dateChange('available', window('11:00', '14:00'));
    expect(applyAvailabilityChange(current, change)).toMatchObject({
      ok: false,
      issue: { overlaps: [window('12:00', '13:00')] },
    });
    expect(current.overrides[0].windows).toHaveLength(2);
    const approved = applyAvailabilityChange(current, change, true);
    if (!approved.ok) throw new Error(approved.issue.message);
    expect(targetWindows(approved.schedule, change.target)).toEqual([
      window('09:00', '17:00'),
    ]);
    expect(current.overrides[0].windows).toHaveLength(2);
    expect(
      applyAvailabilityChange(schedule(), dateChange('unavailable'))
    ).toMatchObject({
      ok: false,
      issue: { overlaps: [window('12:00', '13:00')] },
    });
  });

  it('converts selected time off without self-conflicts and preserves other time-off warnings', () => {
    const current = splitSchedule();
    const origin = {
      mode: 'unavailable' as const,
      window: window('12:00', '13:00'),
    };
    for (const range of [window('12:00', '13:00'), window('12:15', '12:45')]) {
      const change = { ...dateChange('available', range), origin };
      expect(availabilityConflicts(current, change)).toEqual([]);
      const result = applyAvailabilityChange(current, change);
      if (!result.ok) throw new Error(result.issue.message);
      expect(targetWindows(result.schedule, change.target)).toEqual(
        mergeWindows([...current.overrides[0].windows, range])
      );
    }
    current.overrides[0].windows = [
      window('09:00', '12:00'),
      window('13:00', '14:00'),
      window('15:00', '17:00'),
    ];
    const extended = {
      ...dateChange('available', window('12:00', '14:30')),
      origin,
    };
    expect(availabilityConflicts(current, extended)).toEqual([
      window('14:00', '14:30'),
    ]);
    expect(applyAvailabilityChange(current, extended)).toMatchObject({
      ok: false,
      issue: { overlaps: [window('14:00', '14:30')] },
    });
    expect(applyAvailabilityChange(current, extended, true).ok).toBe(true);
  });

  it('replaces partial time off when shrinking and confirms only newly covered hours when expanding or moving', () => {
    const current = splitSchedule();
    const origin = {
      mode: 'unavailable' as const,
      window: window('12:00', '13:00'),
    };
    const shrunk = applyAvailabilityChange(current, {
      ...dateChange('unavailable', window('12:15', '12:45')),
      origin,
    });
    if (!shrunk.ok) throw new Error(shrunk.issue.message);
    expect(targetWindows(shrunk.schedule, { kind: 'date', date })).toEqual([
      window('09:00', '12:15'),
      window('12:45', '17:00'),
    ]);
    const extended = {
      ...dateChange('unavailable', window('12:00', '14:00')),
      origin,
    };
    expect(applyAvailabilityChange(current, extended)).toMatchObject({
      ok: false,
      issue: { overlaps: [window('13:00', '14:00')] },
    });
    const moved = applyAvailabilityChange(
      current,
      { ...dateChange('unavailable', window('14:00', '15:00')), origin },
      true
    );
    if (!moved.ok) throw new Error(moved.issue.message);
    expect(targetWindows(moved.schedule, { kind: 'date', date })).toEqual([
      window('09:00', '14:00'),
      window('15:00', '17:00'),
    ]);
  });

  it('accepts contained same-type time off without creating duplicate ranges and rejects unrelated implicit off-hours', () => {
    const current = splitSchedule();
    const result = applyAvailabilityChange(
      current,
      dateChange('unavailable', window('12:15', '12:45'))
    );
    if (!result.ok) throw new Error(result.issue.message);
    expect(result.schedule.overrides).toEqual(current.overrides);
    expect(
      applyAvailabilityChange(
        current,
        dateChange('unavailable', window('18:00', '19:00'))
      ).ok
    ).toBe(false);
  });

  it('validates captured origins rather than silently editing a new range at the same index', () => {
    const current = splitSchedule();
    expect(
      applyAvailabilityChange(
        current,
        {
          ...dateChange('available', window('10:00', '12:00')),
          index: 0,
          origin: { mode: 'available', window: window('08:00', '12:00') },
        },
        true
      )
    ).toMatchObject({ ok: false });
    expect(
      applyAvailabilityChange(
        current,
        {
          ...dateChange('unavailable', window('12:15', '12:45')),
          origin: { mode: 'unavailable', window: window('11:00', '13:00') },
        },
        true
      )
    ).toMatchObject({ ok: false });
    const copied = copyAvailability(
      current,
      {
        ...dateChange('available', window('10:00', '11:00')),
        index: 4,
        origin: { mode: 'available', window: window('08:00', '12:00') },
      },
      [{ kind: 'weekly', day: 6 }]
    );
    expect(copied.ok).toBe(true);
  });

  it('enforces range limits after merging and never permits malformed ranges with confirmation', () => {
    const current = schedule();
    current.weekly[1].windows = Array.from({ length: 8 }, (_, hour) =>
      window(
        `${String(hour + 8).padStart(2, '0')}:00`,
        `${String(hour + 8).padStart(2, '0')}:30`
      )
    );
    const target = { kind: 'weekly' as const, day: 1 };
    const joined = applyAvailabilityChange(current, {
      target,
      mode: 'available',
      window: window('08:15', '16:00'),
    });
    if (!joined.ok) throw new Error(joined.issue.message);
    expect(targetWindows(joined.schedule, target)).toEqual([
      window('08:00', '16:00'),
    ]);
    expect(
      applyAvailabilityChange(
        current,
        { target, mode: 'available', window: window('19:00', '20:00') },
        true
      )
    ).toMatchObject({ ok: false });
    expect(
      applyAvailabilityChange(
        current,
        { target, mode: 'available', window: window('25:00', '26:00') },
        true
      )
    ).toMatchObject({ ok: false });
  });

  it('requires review for all-day restoration and rejects guessing historical hours during all-day resizing', () => {
    const current = schedule();
    current.overrides = [{ date, windows: [] }];
    const origin = {
      mode: 'unavailable' as const,
      window: window('00:00', '23:59'),
    };
    expect(
      applyAvailabilityChange(
        current,
        { ...dateChange('unavailable'), origin },
        true
      )
    ).toMatchObject({ ok: false });
    const available = { ...dateChange('available'), origin };
    expect(applyAvailabilityChange(current, available)).toMatchObject({
      ok: false,
      issue: { overlaps: [window('12:00', '13:00')] },
    });
    const approved = applyAvailabilityChange(current, available, true);
    if (!approved.ok) throw new Error(approved.issue.message);
    expect(targetWindows(approved.schedule, available.target)).toEqual([
      available.window,
    ]);
  });
});
