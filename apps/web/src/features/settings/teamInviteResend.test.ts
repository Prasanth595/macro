import { describe, expect, it } from 'vitest';
import { canResendInvite, inviteResendAvailableAt } from './teamInviteResend';

const lastSentAt = '2026-10-20T12:00:00.000Z';

describe('canResendInvite', () => {
  it('waits out the invite email rate limit', () => {
    expect(canResendInvite(lastSentAt, new Date('2026-10-21T12:00:00Z'))).toBe(
      false
    );
    expect(canResendInvite(lastSentAt, new Date('2026-10-22T11:59:59Z'))).toBe(
      false
    );
  });

  it('allows a resend two days after the last email', () => {
    expect(canResendInvite(lastSentAt, new Date('2026-10-22T12:00:00Z'))).toBe(
      true
    );
  });
});

describe('inviteResendAvailableAt', () => {
  it('is two days after the last email', () => {
    expect(inviteResendAvailableAt(lastSentAt).toISOString()).toBe(
      '2026-10-22T12:00:00.000Z'
    );
  });
});
