import { createRoot, createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AvailabilityChange } from '../core/availability';
import { newSchedule } from '../core/types';
import { createAvailabilityEditor } from './create-availability-editor';
import { createAvailabilityMonthEditor } from './create-availability-month-editor';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
});
function setup() {
  return createRoot((cleanup) => {
    dispose = cleanup;
    const [schedule, setSchedule] = createSignal(newSchedule('UTC'));
    const [disabled, setDisabled] = createSignal(false);
    const onEditingChange = vi.fn();
    const editor = createAvailabilityEditor({
      schedule,
      disabled,
      onChange: setSchedule,
    });
    const stamp = createAvailabilityMonthEditor({
      schedule,
      disabled,
      unavailable: editor.displayUnavailableWindows,
      copy: editor.copy,
      onEditingChange,
    });
    return { schedule, setDisabled, stamp, editor, onEditingChange };
  });
}
const template = (
  mode: AvailabilityChange['mode'] = 'available'
): AvailabilityChange => ({
  target: { kind: 'date', date: '2026-10-05' },
  mode,
  window: { start: '10:00', end: '11:00' },
});

describe('monthly availability batch preview', () => {
  it('keeps preview and exit separate from schedule mutation and does not mutate its source', () => {
    const { schedule, stamp, onEditingChange } = setup();
    const original = schedule();
    const source = template();
    stamp.begin(source);
    stamp.select(['2026-10-06', '2026-10-07']);
    expect(schedule()).toBe(original);
    stamp.select(['2026-10-06'], true);
    expect(stamp.dates()).toEqual(['2026-10-07']);
    stamp.select(['not-a-date']);
    expect(stamp.dates()).toEqual(['2026-10-07']);
    stamp.exit();
    expect(stamp.template()).toBeUndefined();
    expect(stamp.dates()).toEqual([]);
    expect(schedule()).toBe(original);
    expect(source).toEqual(template());
    expect(onEditingChange).toHaveBeenLastCalledWith(false);
  });
  it('validates all destinations atomically and requires explicit opposite-type replacement', () => {
    const { schedule, stamp, editor } = setup();
    editor.open(template('unavailable'));
    editor.apply(true);
    const original = schedule();
    stamp.begin({
      ...template(),
      target: { kind: 'date', date: '2026-10-06' },
      window: { start: '09:00', end: '17:00' },
    });
    // The first destination is free; the second contains explicit time off.
    stamp.select(['2026-10-04', '2026-10-05']);
    expect(stamp.conflicts().map((value) => value.date)).toEqual([
      '2026-10-05',
    ]);
    expect(stamp.apply()).toBe(false);
    expect(schedule()).toBe(original);
    expect(stamp.dates()).toHaveLength(2);
    expect(stamp.apply(true)).toBe(true);
    expect(schedule().overrides).toHaveLength(2);
    expect(
      schedule().overrides.find((value) => value.date === '2026-10-05')?.windows
    ).toEqual([{ start: '09:00', end: '17:00' }]);
    expect(editor.displayUnavailableWindows('2026-10-05')).toEqual([]);
    expect(stamp.dates()).toEqual([]);
    expect(stamp.template()).toBeDefined();
  });
  it('deduplicates target dates, merges available hours, and leaves recurring rules unchanged', () => {
    const { schedule, stamp } = setup();
    const recurring = schedule().weekly;
    stamp.begin({ ...template(), window: { start: '16:00', end: '18:00' } });
    stamp.select(['2026-10-06', '2026-10-06']);
    stamp.select(['2026-10-07']);
    expect(stamp.apply()).toBe(true);
    expect(schedule().overrides).toEqual([
      { date: '2026-10-06', windows: [{ start: '09:00', end: '18:00' }] },
      { date: '2026-10-07', windows: [{ start: '09:00', end: '18:00' }] },
    ]);
    expect(schedule().weekly).toEqual(recurring);
  });
  it('applies mixed weekday/weekend time-off batches without creating off-day events', () => {
    const { schedule, stamp, editor } = setup();
    stamp.begin({
      ...template('unavailable'),
      window: { start: '09:00', end: '17:00' },
    });
    stamp.select(['2026-10-09', '2026-10-10']);
    expect(stamp.apply()).toBe(false);
    expect(schedule().overrides).toEqual([]);
    expect(stamp.apply(true)).toBe(true);
    expect(schedule().overrides).toEqual([{ date: '2026-10-09', windows: [] }]);
    expect(editor.displayUnavailableWindows('2026-10-10')).toEqual([]);
  });
  it('blocks selection and application while saving', () => {
    const { schedule, stamp, setDisabled } = setup();
    stamp.begin(template());
    stamp.select(['2026-10-06']);
    setDisabled(true);
    stamp.select(['2026-10-07']);
    stamp.clear();
    stamp.exit();
    expect(stamp.dates()).toEqual(['2026-10-06']);
    expect(stamp.apply()).toBe(false);
    expect(schedule().overrides).toEqual([]);
  });
});
