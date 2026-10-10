import { createRoot, createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { targetWindows } from '../core/availability';
import { shiftReportDate } from '../core/insights';
import { type AvailabilitySchedule, newSchedule } from '../core/types';
import { createAvailabilityEditor } from './create-availability-editor';

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});
function fixture(initial = newSchedule('America/New_York')) {
  return createRoot((dispose) => {
    disposers.push(dispose);
    const [schedule, setSchedule] = createSignal(initial);
    const [disabled, setDisabled] = createSignal(false);
    const onChange = vi.fn(
      (update: (current: AvailabilitySchedule) => AvailabilitySchedule) =>
        setSchedule(update)
    );
    const onEditingChange = vi.fn();
    const editor = createAvailabilityEditor({
      schedule,
      disabled,
      onChange,
      onEditingChange,
    });
    return { schedule, setDisabled, onChange, onEditingChange, editor };
  });
}

describe('availability editor state', () => {
  it('keeps opposite-type drafts open until explicit replacement succeeds', () => {
    const { editor, schedule, onChange, onEditingChange } = fixture();
    editor.open({
      target: { kind: 'date', date: '2026-10-05' },
      mode: 'unavailable',
      window: { start: '12:00', end: '13:00' },
    });
    expect(onEditingChange).toHaveBeenLastCalledWith(true);
    editor.apply();
    expect(editor.issue()?.overlaps).toEqual([
      { start: '12:00', end: '13:00' },
    ]);
    expect(editor.selection()).toBeDefined();
    expect(onChange).not.toHaveBeenCalled();
    editor.apply(true);
    expect(editor.selection()).toBeUndefined();
    expect(onEditingChange).toHaveBeenLastCalledWith(false);
    expect(
      targetWindows(schedule(), { kind: 'date', date: '2026-10-05' })
    ).toEqual([
      { start: '09:00', end: '12:00' },
      { start: '13:00', end: '17:00' },
    ]);
  });

  it('updates type-change warnings immediately and only requires approval for sibling time off', () => {
    const initial = newSchedule('America/New_York');
    const date = '2026-10-05';
    initial.overrides = [
      {
        date,
        windows: [
          { start: '09:00', end: '12:00' },
          { start: '13:00', end: '14:00' },
          { start: '15:00', end: '17:00' },
        ],
      },
    ];
    const { editor, schedule, onChange } = fixture(initial);
    const target = { kind: 'date' as const, date };
    editor.open({
      target,
      mode: 'unavailable',
      window: { start: '12:00', end: '13:00' },
      origin: { mode: 'unavailable', window: { start: '12:00', end: '13:00' } },
    });
    editor.updateSelection((change) => ({ ...change, mode: 'available' }));
    expect(editor.issue()).toBeUndefined();
    editor.updateSelection((change) => ({
      ...change,
      window: { start: '12:00', end: '14:30' },
    }));
    expect(editor.issue()?.overlaps).toEqual([
      { start: '14:00', end: '14:30' },
    ]);
    editor.apply();
    expect(onChange).not.toHaveBeenCalled();
    expect(editor.selection()).toBeDefined();
    editor.apply(true);
    expect(editor.selection()).toBeUndefined();
    expect(targetWindows(schedule(), target)).toEqual([
      { start: '09:00', end: '14:30' },
      { start: '15:00', end: '17:00' },
    ]);
    expect(editor.displayUnavailableWindows(date)).toEqual([
      { start: '14:30', end: '15:00' },
    ]);
  });
  it('automatically merges same-type drafts and derives opposite warnings before applying', () => {
    const { editor, schedule, onChange } = fixture();
    editor.open({
      target: { kind: 'weekly', day: 1 },
      mode: 'available',
      window: { start: '16:00', end: '18:00' },
    });
    expect(editor.issue()).toBeUndefined();
    editor.apply();
    expect(targetWindows(schedule(), { kind: 'weekly', day: 1 })).toEqual([
      { start: '09:00', end: '18:00' },
    ]);
    editor.open({
      target: { kind: 'date', date: '2026-10-05' },
      mode: 'unavailable',
      window: { start: '12:00', end: '13:00' },
    });
    expect(editor.issue()?.overlaps).toEqual([
      { start: '12:00', end: '13:00' },
    ]);
    const calls = onChange.mock.calls.length;
    editor.updateSelection((change) => ({
      ...change,
      window: { start: '17:00', end: '19:00' },
    }));
    expect(editor.issue()?.overlaps).toEqual([
      { start: '17:00', end: '18:00' },
    ]);
    expect(onChange.mock.calls).toHaveLength(calls);
    editor.close();
    expect(editor.issue()).toBeUndefined();
  });

  it('recomputes conflicts after source changes and captures immutable edit origins', () => {
    const { editor, onChange } = fixture();
    const origin = {
      mode: 'available' as const,
      window: { start: '09:00', end: '17:00' },
    };
    editor.open({
      target: { kind: 'weekly', day: 1 },
      mode: 'available',
      index: 0,
      origin,
      window: { start: '10:00', end: '17:00' },
    });
    origin.window.end = '18:00';
    expect(editor.selection()?.origin?.window.end).toBe('17:00');
    editor.open({
      target: { kind: 'date', date: '2026-10-05' },
      mode: 'unavailable',
      window: { start: '12:00', end: '13:00' },
    });
    editor.apply();
    expect(editor.issue()?.overlaps).toHaveLength(1);
    onChange((schedule) => ({
      ...schedule,
      overrides: [
        {
          date: '2026-10-05',
          windows: [
            { start: '09:00', end: '12:00' },
            { start: '13:00', end: '17:00' },
          ],
        },
      ],
    }));
    expect(editor.issue()).toBeUndefined();
    editor.apply();
    expect(editor.selection()).toBeUndefined();
  });

  it('remembers split weekly and date hours across off/on toggles', () => {
    const initial = newSchedule('America/New_York');
    const windows = [
      { start: '08:30', end: '11:45' },
      { start: '13:15', end: '16:30' },
    ];
    initial.weekly[1].windows = windows;
    initial.overrides = [{ date: '2026-10-05', windows }];
    const { editor, schedule } = fixture(initial);
    for (const target of [
      { kind: 'weekly' as const, day: 1 },
      { kind: 'date' as const, date: '2026-10-05' },
    ]) {
      editor.toggle(target, false);
      expect(targetWindows(schedule(), target)).toEqual([]);
      editor.toggle(target, true);
      expect(targetWindows(schedule(), target)).toEqual(windows);
    }
    expect(initial.weekly[1].windows).toEqual(windows);
  });

  it('restores inherited hours and removes overrides without changing the weekly schedule', () => {
    const { editor, schedule } = fixture();
    const target = { kind: 'date' as const, date: '2026-10-05' };
    editor.toggle(target, false);
    expect(schedule().overrides).toEqual([{ date: target.date, windows: [] }]);
    editor.toggle(target, true);
    expect(targetWindows(schedule(), target)).toEqual([
      { start: '09:00', end: '17:00' },
    ]);
    editor.restoreDate(target.date);
    expect(schedule().overrides).toEqual([]);
    expect(targetWindows(schedule(), target)).toEqual([
      { start: '09:00', end: '17:00' },
    ]);
  });

  it('shows disabled weekly bars and forgets them after edits, copies, and removals', () => {
    const { editor, schedule } = fixture();
    const monday = { kind: 'weekly' as const, day: 1 };
    const tuesday = { kind: 'weekly' as const, day: 2 };
    editor.toggle(monday, false);
    expect(editor.displayWeeklyWindows(1)).toEqual([
      { start: '09:00', end: '17:00' },
    ]);
    editor.toggle(monday, true);
    expect(editor.displayWeeklyWindows(1)).toEqual(
      schedule().weekly[1].windows
    );
    editor.toggle(monday, false);
    editor.open({
      target: monday,
      mode: 'available',
      window: { start: '12:00', end: '13:00' },
    });
    editor.apply();
    editor.remove(monday, 0);
    expect(editor.displayWeeklyWindows(1)).toEqual([]);
    editor.toggle(monday, false);
    expect(
      editor.copy(
        {
          target: monday,
          mode: 'available',
          window: { start: '18:00', end: '19:00' },
        },
        [monday],
        false
      ).ok
    ).toBe(true);
    editor.remove(monday, 0);
    expect(editor.displayWeeklyWindows(1)).toEqual([]);
    editor.toggle(tuesday, false);
    editor.remove(tuesday, 0);
    expect(editor.displayWeeklyWindows(2)).toEqual([]);
  });

  it('remembers effective date hours for successful time off, copies, and clears them on restoration', () => {
    const initial = newSchedule('America/New_York');
    const date = '2026-10-05';
    initial.weekly[1].windows = [];
    initial.overrides = [{ date, windows: [{ start: '18:00', end: '21:00' }] }];
    const { editor, schedule } = fixture(initial);
    const change = {
      target: { kind: 'date' as const, date },
      mode: 'unavailable' as const,
      window: { start: '20:00', end: '21:00' },
    };
    editor.open(change);
    editor.apply(true);
    expect(editor.displayUnavailableWindows(date)).toEqual([
      { start: '20:00', end: '21:00' },
    ]);
    editor.restoreDate(date);
    expect(editor.displayUnavailableWindows(date)).toEqual([]);
    expect(schedule().overrides).toEqual([]);

    const copiedDate = '2026-10-06';
    const copy = { ...change, window: { start: '12:00', end: '13:00' } };
    expect(
      editor.copy(copy, [{ kind: 'date', date: copiedDate }], false).ok
    ).toBe(false);
    expect(
      editor.copy(copy, [{ kind: 'date', date: copiedDate }], true).ok
    ).toBe(true);
    expect(editor.displayUnavailableWindows(copiedDate)).toEqual([
      { start: '12:00', end: '13:00' },
    ]);
  });

  it('keeps earlier custom time off visible after more cuts and available-hour edits', () => {
    const initial = newSchedule('America/New_York');
    const date = '2026-10-05';
    initial.weekly[1].windows = [];
    initial.overrides = [{ date, windows: [{ start: '18:00', end: '21:00' }] }];
    const { editor } = fixture(initial);
    const target = { kind: 'date' as const, date };
    for (const window of [
      { start: '18:00', end: '19:00' },
      { start: '20:00', end: '21:00' },
    ]) {
      editor.open({ target, window, mode: 'unavailable' });
      editor.apply(true);
      expect(editor.issue()).toBeUndefined();
    }
    expect(editor.displayUnavailableWindows(date)).toEqual([
      { start: '18:00', end: '19:00' },
      { start: '20:00', end: '21:00' },
    ]);
    editor.open({
      target,
      mode: 'available',
      index: 0,
      window: { start: '19:15', end: '20:00' },
    });
    editor.apply();
    expect(editor.displayUnavailableWindows(date)).toEqual([
      { start: '18:00', end: '19:15' },
      { start: '20:00', end: '21:00' },
    ]);
  });

  it('does not revive deleted ranges from remembered date hours', () => {
    const initial = newSchedule('America/New_York');
    const date = '2026-10-05';
    initial.overrides = [{ date, windows: [{ start: '18:00', end: '21:00' }] }];
    const { editor } = fixture(initial);
    editor.open({
      target: { kind: 'date', date },
      mode: 'unavailable',
      window: { start: '20:00', end: '21:00' },
    });
    editor.apply(true);
    editor.remove({ kind: 'date', date }, 0);
    expect(editor.displayUnavailableWindows(date)).toEqual([
      { start: '00:00', end: '23:59' },
    ]);
    editor.restoreDate(date);
    expect(editor.displayUnavailableWindows(date)).toEqual([]);
  });

  it('rejects excess date overrides when using header toggles', () => {
    const initial = newSchedule('America/New_York');
    initial.overrides = Array.from({ length: 366 }, (_, index) => ({
      date: shiftReportDate('2026-01-01', index),
      windows: [],
    }));
    const { editor, schedule, onChange } = fixture(initial);
    editor.toggle({ kind: 'date', date: '2028-01-01' }, false);
    expect(editor.actionError()).toContain('366');
    expect(onChange).not.toHaveBeenCalled();
    expect(schedule().overrides).toHaveLength(366);
  });

  it('blocks changes during a save and applies multi-destination copying atomically', () => {
    const initial = newSchedule('America/New_York');
    initial.overrides = [{ date: '2026-10-06', windows: [] }];
    const { editor, schedule, setDisabled, onChange } = fixture(initial);
    const change = {
      target: { kind: 'weekly' as const, day: 1 },
      mode: 'available' as const,
      window: { start: '10:00', end: '11:00' },
    };
    const targets = [
      { kind: 'date' as const, date: '2026-10-10' },
      { kind: 'date' as const, date: '2026-10-06' },
    ];
    expect(editor.copy(change, targets, false).ok).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(editor.copy(change, targets, true).ok).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(targetWindows(schedule(), targets[0])).toEqual([change.window]);
    setDisabled(true);
    editor.toggle(targets[0], false);
    editor.remove(targets[0], 0);
    editor.open(change);
    expect(editor.copy(change, targets, true).ok).toBe(false);
    expect(editor.selection()).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
