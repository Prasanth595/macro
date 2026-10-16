import { describe, expect, it } from 'vitest';
import { calendarTimeAssumption } from './calendar-time-assumption';

describe('calendar time assumptions', () => {
  it('explains an assumed evening time without hiding the editable value', () => {
    expect(
      calendarTimeAssumption(
        'call with julia tomorrow at 7',
        '2026-10-10T19:00'
      )
    ).toContain('Assumed 7:00 PM');
  });
  it('only marks an ambiguous hour, including minutes', () => {
    expect(
      calendarTimeAssumption('Call at 7:30', '2026-10-10T19:30')
    ).toContain('Assumed 7:30 PM');
    for (const text of [
      'Call at 7pm',
      'Call at 7 AM',
      'Call at 19:00',
      'Call at 7 in the morning',
    ])
      expect(calendarTimeAssumption(text, '2026-10-10T19:00')).toBeUndefined();
  });
});
