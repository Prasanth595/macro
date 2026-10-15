import { describe, expect, it } from 'vitest';
import { availabilityWeekGroups } from './availability-summary';
import {
  meetingPlaceLabel,
  newEventType,
  newSchedule,
  validateEvent,
  validateSchedule,
} from './types';

describe('scheduling form validation', () => {
  it('rejects overlapping hours and allows adjacent windows', () => {
    const schedule = newSchedule('America/New_York');
    schedule.weekly[1].windows = [
      { start: '09:00', end: '12:00' },
      { start: '11:00', end: '17:00' },
    ];
    expect(validateSchedule(schedule)).toContain('overlap');
    schedule.weekly[1].windows[1].start = '12:00';
    expect(validateSchedule(schedule)).toBeUndefined();
  });
  it('rejects duplicate links and fractional booking durations', () => {
    const event = {
      ...newEventType('schedule', ['host'], false),
      title: 'Meeting',
      slug: 'meeting',
    };
    expect(validateEvent(event, [{ ...event, id: 'another' }])).toContain(
      'link'
    );
    expect(validateEvent({ ...event, durationMinutes: 30.5 }, [])).toContain(
      'Duration'
    );
    expect(validateEvent(event, [])).toBeUndefined();
  });
  it('defaults a new link to a Macro call', () => {
    const event = newEventType('schedule', ['host'], false);
    expect(event.macroCall).toBe(true);
    expect(event.googleMeet).toBe(false);
    expect(meetingPlaceLabel(event)).toBe('Macro call');
    expect(
      meetingPlaceLabel({ ...event, macroCall: false, googleMeet: true })
    ).toBe('Google Meet');
    expect(
      meetingPlaceLabel({
        ...event,
        macroCall: false,
        googleMeet: false,
        location: 'Studio 4',
      })
    ).toBe('Studio 4');
  });
});

describe('availability card summaries', () => {
  it('groups consecutive equal hours without changing the schedule', () => {
    const schedule = newSchedule('America/New_York');
    schedule.weekly[1].windows = [
      { start: '13:00', end: '17:00' },
      { start: '09:00', end: '12:00' },
    ];
    schedule.weekly[2].windows = [...schedule.weekly[1].windows].reverse();
    schedule.weekly.reverse();
    const original = structuredClone(schedule);

    const groups = availabilityWeekGroups(schedule);

    expect(groups.map((group) => group.days)).toEqual([
      [1, 2],
      [3, 4, 5],
      [6, 0],
    ]);
    expect(groups[0].hours.windows).toEqual([
      { start: '09:00', end: '12:00' },
      { start: '13:00', end: '17:00' },
    ]);
    expect(schedule).toEqual(original);
  });

  it('distinguishes explicit time off from unset hours and ignores date exceptions', () => {
    const schedule = newSchedule('UTC');
    schedule.weekly = [
      { day: 1, windows: [] },
      {
        day: 2,
        windows: [],
        unavailableWindows: [{ start: '00:00', end: '23:59' }],
      },
    ];
    schedule.overrides = [
      { date: '2026-10-12', windows: [{ start: '09:00', end: '17:00' }] },
    ];

    const groups = availabilityWeekGroups(schedule);

    expect(groups.map((group) => group.days)).toEqual([
      [1],
      [2],
      [3, 4, 5, 6, 0],
    ]);
    expect(groups[0].hours).toEqual({ windows: [], unavailableWindows: [] });
    expect(groups[1].hours.unavailableWindows).toEqual([
      { start: '00:00', end: '23:59' },
    ]);
    expect(groups[2].hours).toEqual({ windows: [], unavailableWindows: [] });
  });
});
