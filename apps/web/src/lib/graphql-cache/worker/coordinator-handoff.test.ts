import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CoordinatorHandoff } from './coordinator-handoff';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('bounds reads through drain and startup without extending the budget on visibility churn', async () => {
  const record = vi.fn();
  const onBlocked = vi.fn();
  const handoff = new CoordinatorHandoff({
    timeoutMs: 1000,
    setTimeout,
    clearTimeout,
    now: Date.now,
    telemetry: { record, flush() {} },
    onBlocked,
  });
  handoff.start(1);
  await vi.advanceTimersByTimeAsync(900);
  handoff.start(2);
  await vi.advanceTimersByTimeAsync(100);
  expect(onBlocked).toHaveBeenCalledExactlyOnceWith(1);
  expect(handoff.readBlockedEpoch).toBe(1);
  handoff.ready();
  expect(handoff.readBlockedEpoch).toBeUndefined();
  expect(record).toHaveBeenCalledWith(
    expect.objectContaining({
      ownerEvent: 'visibility-handoff-completed',
      durationMs: 1000,
    })
  );
});

it('cancels a healthy handoff deadline and does not resume blocked reads on failure alone', async () => {
  const onBlocked = vi.fn();
  const handoff = new CoordinatorHandoff({
    timeoutMs: 1000,
    setTimeout,
    clearTimeout,
    now: Date.now,
    telemetry: { record() {}, flush() {} },
    onBlocked,
  });
  handoff.start(1);
  handoff.ready();
  await vi.advanceTimersByTimeAsync(1000);
  expect(onBlocked).not.toHaveBeenCalled();
  handoff.start(2);
  await vi.advanceTimersByTimeAsync(1000);
  handoff.cancel();
  expect(handoff.readBlockedEpoch).toBe(2);
  handoff.ready();
  expect(handoff.readBlockedEpoch).toBeUndefined();
});
