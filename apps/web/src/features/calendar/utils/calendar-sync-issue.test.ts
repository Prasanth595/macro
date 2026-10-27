import { describe, expect, it } from 'vitest';
import { calendarSyncIssue } from './calendar-sync-issue';

describe('calendarSyncIssue', () => {
  it('replaces normalization traces with a stable, readable issue', () => {
    const first = calendarSyncIssue(
      'Google Calendar snapshot could not be fully normalized: Google event provider-event has an invalid interval\ncrates/calendar_events/src/outbound/google.rs:2507\nTracing spans: account_id=private-account'
    );
    const retried = calendarSyncIssue(
      'Google Calendar snapshot could not be fully normalized: Google event provider-event has an invalid interval\nTracing spans: job_id=new-job'
    );
    expect(first.kind).toBe('invalid-event');
    expect(retried).toEqual(first);
    expect(JSON.stringify(first)).not.toMatch(
      /provider-event|private-account|Tracing spans|crates\//
    );
  });

  it('does not expose unknown provider responses or suggest retrying an uncertain reply', () => {
    const unavailable = calendarSyncIssue(
      'reqwest::Error { url: https://provider.invalid/private-calendar, source: InternalFailure }'
    );
    expect(unavailable.kind).toBe('unavailable');
    expect(JSON.stringify(unavailable)).not.toContain('private-calendar');
    expect(JSON.stringify(unavailable)).not.toContain('reqwest');

    const reply = calendarSyncIssue(
      'An automatic invitation reply could not be confirmed. Check the invitation in Outlook before replying again.'
    );
    expect(reply.kind).toBe('unconfirmed-reply');
    expect(reply.description).not.toContain('keep trying');
    expect(reply.description).toContain('before replying again');
  });
});
