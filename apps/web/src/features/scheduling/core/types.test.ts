import { describe, expect, it } from 'vitest';
import {
  BUFFER_TIMELINE,
  bookingTimelinePosition,
  bookingTimelineValue,
  NOTICE_TIMELINE,
  WINDOW_TIMELINE,
} from './booking-rule-timeline';
import {
  bookingLinkSlug,
  configuredBookingQuestions,
  eventEditorStepError,
} from './event-editor';
import {
  eventRuleIssues,
  newEventType,
  newSchedule,
  validateEvent,
  validateEventRules,
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
  it('requires the booking window to extend past the notice period', () => {
    const event = newEventType('schedule', ['host'], false);
    const rangeIssue = {
      field: 'horizonDays',
      message: 'The booking window must extend beyond the notice period.',
    };

    expect(
      eventRuleIssues({ ...event, horizonDays: 1, noticeMinutes: 1440 })
    ).toEqual([rangeIssue]);
    expect(
      eventRuleIssues({ ...event, horizonDays: 1, noticeMinutes: 2880 })
    ).toEqual([rangeIssue]);
    expect(
      eventRuleIssues({ ...event, horizonDays: 1, noticeMinutes: 1439 })
    ).toEqual([]);
    expect(
      eventRuleIssues({ ...event, horizonDays: 2, noticeMinutes: 1500 })
    ).toEqual([]);
    expect(
      eventRuleIssues({ ...event, horizonDays: 7, noticeMinutes: 10080 })
    ).toEqual([rangeIssue]);
    expect(
      eventRuleIssues({ ...event, horizonDays: 8, noticeMinutes: 10080 })
    ).toEqual([]);
    expect(
      validateEventRules({ ...event, horizonDays: 1, noticeMinutes: 1440 })
    ).toBe(rangeIssue.message);
  });
  it('only reports individual field limits for invalid booking ranges', () => {
    const event = newEventType('schedule', ['host'], false);
    expect(
      eventRuleIssues({ ...event, horizonDays: 0, noticeMinutes: 0 })
    ).toEqual([
      { field: 'horizonDays', message: 'Booking window must be 1–365 days.' },
    ]);
    expect(
      eventRuleIssues({ ...event, horizonDays: 1, noticeMinutes: 10081 })
    ).toEqual([
      {
        field: 'noticeMinutes',
        message: 'Buffers and notice must be between 0 and 10,080 minutes.',
      },
    ]);
    expect(
      eventRuleIssues({ ...event, horizonDays: 1.5, noticeMinutes: 2160 })
    ).toEqual([
      { field: 'horizonDays', message: 'Booking window must be 1–365 days.' },
    ]);
  });
  it('only validates custom link text when provided and generates a unique automatic link', () => {
    const event = {
      ...newEventType('schedule', ['host'], false),
      title: 'Meeting',
    };
    const existing = { ...event, id: 'another', slug: 'meeting' };
    expect(validateEvent(event, [existing])).toBeUndefined();
    expect(
      validateEvent({ ...event, slug: '   ' }, [existing])
    ).toBeUndefined();
    expect(validateEvent({ ...event, slug: 'Not a valid link' }, [])).toContain(
      'link'
    );
    expect(bookingLinkSlug(event, [existing])).toBe('meeting-2');
    const longTitle = { ...event, title: `${'a'.repeat(77)} bbbbb` };
    const longSlug = bookingLinkSlug(longTitle, []);
    const nextLongSlug = bookingLinkSlug(longTitle, [
      { ...existing, slug: longSlug },
    ]);
    expect(nextLongSlug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(nextLongSlug.length).toBeLessThanOrEqual(80);
    expect(bookingLinkSlug({ ...event, title: '打ち合わせ' }, [])).toBe(
      'booking'
    );
    expect(bookingLinkSlug({ ...event, slug: 'custom-link' }, [existing])).toBe(
      'custom-link'
    );
  });
  it('validates only the active editor step and validates every field for review', () => {
    const event = {
      ...newEventType('schedule', ['host'], false),
      title: 'Meeting',
      slug: 'meeting',
      questions: [{ id: 'question', label: '', required: true }],
      intervalMinutes: 0,
    };
    expect(eventEditorStepError(event, [], 'details')).toBeUndefined();
    expect(eventEditorStepError(event, [], 'location')).toBeUndefined();
    expect(eventEditorStepError(event, [], 'questions')).toBeUndefined();
    expect(eventEditorStepError(event, [], 'rules')).toContain('interval');
    expect(eventEditorStepError(event, [], 'review')).toContain('interval');
    expect(
      eventEditorStepError({ ...event, scheduleId: '' }, [], 'location')
    ).toContain('availability');
    expect(
      eventEditorStepError({ ...event, hosts: [] }, [], 'location')
    ).toContain('host');
  });
  it('omits blank editor questions while retaining configured question IDs and requirements', () => {
    const question = {
      id: 'filled',
      label: 'What should we discuss?',
      required: true,
    };
    const event = {
      ...newEventType('schedule', ['host'], false),
      title: 'Meeting',
      slug: 'meeting',
      questions: [
        { id: 'empty', label: '', required: false },
        { id: 'whitespace', label: '   ', required: true },
        question,
      ],
    };
    expect(configuredBookingQuestions(event.questions)).toEqual([question]);
    expect(eventEditorStepError(event, [], 'questions')).toBeUndefined();
    expect(eventEditorStepError(event, [], 'review')).toBeUndefined();
    expect(
      validateEvent(
        { ...event, questions: configuredBookingQuestions(event.questions) },
        []
      )
    ).toBeUndefined();
  });
});

describe('booking timeline scales', () => {
  it('preserves every supported whole value and monotonically increases position', () => {
    for (const scale of [NOTICE_TIMELINE, BUFFER_TIMELINE, WINDOW_TIMELINE]) {
      let previous = -1;
      for (let value = scale[0]; value <= scale.at(-1)!; value++) {
        const position = bookingTimelinePosition(value, scale);
        expect(position).toBeGreaterThanOrEqual(previous);
        expect(bookingTimelineValue(position, scale)).toBe(value);
        previous = position;
      }
    }
  });
  it('maps every labelled landmark exactly and bounds slider gestures', () => {
    for (const scale of [NOTICE_TIMELINE, BUFFER_TIMELINE, WINDOW_TIMELINE]) {
      scale.forEach((value, index) => {
        const position = (index / (scale.length - 1)) * 100;
        expect(bookingTimelinePosition(value, scale)).toBeCloseTo(position);
        expect(bookingTimelineValue(position, scale)).toBe(value);
      });
      expect(bookingTimelineValue(-10, scale)).toBe(scale[0]);
      expect(bookingTimelineValue(110, scale)).toBe(scale.at(-1));
    }
  });
});
