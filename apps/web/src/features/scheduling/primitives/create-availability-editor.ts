import { type Accessor, createSignal } from 'solid-js';
import {
  type AvailabilityChange,
  type AvailabilityIssue,
  type AvailabilityResult,
  type AvailabilityTarget,
  applyAvailabilityChange,
  availabilityConflictIssue,
  availabilityTargetIssue,
  calendarUnavailableWindows,
  copyAvailability,
  mergeWindows,
  rangeOverlaps,
  setTargetWindows,
  targetWindows,
  windowsIssue,
} from '../core/availability';
import type { AvailabilitySchedule, TimeWindow } from '../core/types';

export function createAvailabilityEditor(props: {
  schedule: Accessor<AvailabilitySchedule>;
  disabled: Accessor<boolean>;
  onEditingChange?: (editing: boolean) => void;
  onChange: (
    update: (current: AvailabilitySchedule) => AvailabilitySchedule
  ) => void;
}) {
  const [selection, setSelection] = createSignal<AvailabilityChange>();
  const [validationIssue, setIssue] = createSignal<AvailabilityIssue>();
  const [notice, setNotice] = createSignal('');
  const [actionError, setActionError] = createSignal('');
  const remembered = new Map<string, TimeWindow[]>();
  const targetKey = (target: AvailabilityTarget) =>
    target.kind === 'weekly' ? `day:${target.day}` : target.date;
  const displayWeeklyWindows = (day: number) => {
    const target: AvailabilityTarget = { kind: 'weekly', day };
    const windows = targetWindows(props.schedule(), target);
    return windows.length ? windows : (remembered.get(targetKey(target)) ?? []);
  };
  const displayUnavailableWindows = (date: string) =>
    calendarUnavailableWindows(
      props.schedule(),
      date,
      remembered.get(date) ?? []
    );
  const issue = () => {
    const invalid = validationIssue();
    if (invalid) return invalid;
    const current = selection();
    if (!current) return;
    return availabilityConflictIssue(
      props.schedule(),
      current,
      current.target.kind === 'date'
        ? displayUnavailableWindows(current.target.date)
        : undefined
    );
  };
  const rememberDate = (
    schedule: AvailabilitySchedule,
    date: string,
    extra: TimeWindow[] = []
  ) => {
    remembered.set(
      date,
      mergeWindows([
        ...(remembered.get(date) ?? []),
        ...targetWindows(schedule, { kind: 'date', date }),
        ...extra,
      ])
    );
  };
  const open = (change: AvailabilityChange) => {
    if (props.disabled()) return;
    setActionError('');
    props.onEditingChange?.(true);
    setIssue(undefined);
    setNotice('');
    setSelection({
      ...change,
      window: { ...change.window },
      origin: change.origin
        ? { ...change.origin, window: { ...change.origin.window } }
        : undefined,
    });
  };
  const close = () => {
    setSelection(undefined);
    props.onEditingChange?.(false);
    setIssue(undefined);
  };
  const updateSelection = (
    update: (current: AvailabilityChange) => AvailabilityChange
  ) => {
    setSelection((current) => (current ? update(current) : current));
    setIssue(undefined);
  };
  const apply = (replaceConflicts = false) => {
    const current = selection();
    if (!current || props.disabled()) return;
    const schedule = props.schedule();
    const result = applyAvailabilityChange(
      schedule,
      current,
      replaceConflicts,
      current.target.kind === 'date'
        ? displayUnavailableWindows(current.target.date)
        : undefined
    );
    if (!result.ok) {
      setIssue(result.issue.overlaps?.length ? undefined : result.issue);
      return;
    }
    if (current.target.kind === 'date') {
      if (current.mode === 'unavailable')
        rememberDate(schedule, current.target.date, [
          ...(current.origin?.mode === 'unavailable'
            ? [current.origin.window]
            : []),
          current.allDay ? { start: '00:00', end: '23:59' } : current.window,
        ]);
    } else remembered.delete(targetKey(current.target));
    props.onChange(() => result.schedule);
    close();
    setNotice(
      current.mode === 'unavailable'
        ? 'Time off added to this date.'
        : 'Availability updated.'
    );
  };
  const copy = (
    change: AvailabilityChange,
    targets: AvailabilityTarget[],
    replaceConflicts: boolean
  ): AvailabilityResult => {
    if (props.disabled())
      return {
        ok: false,
        issue: {
          message: 'Wait for the schedule to finish saving.',
          mergeable: false,
        },
      };
    const schedule = props.schedule();
    const unavailableByDate = new Map(
      targets.flatMap((target) =>
        target.kind === 'date'
          ? [[target.date, displayUnavailableWindows(target.date)] as const]
          : []
      )
    );
    const result = copyAvailability(
      schedule,
      change,
      targets,
      replaceConflicts,
      unavailableByDate
    );
    if (result.ok) {
      for (const target of targets) {
        if (target.kind === 'weekly') remembered.delete(targetKey(target));
        else if (
          change.mode === 'unavailable' &&
          (change.allDay ||
            rangeOverlaps(change.window, targetWindows(schedule, target))
              .length)
        )
          rememberDate(schedule, target.date, [
            change.allDay ? { start: '00:00', end: '23:59' } : change.window,
          ]);
      }
      props.onChange(() => result.schedule);
      setNotice(
        `Copied to ${targets.length} ${targets.length === 1 ? 'day' : 'days'}.`
      );
    }
    return result;
  };
  const toggle = (target: AvailabilityTarget, checked: boolean) => {
    if (props.disabled()) return;
    setActionError('');
    const targetIssue = availabilityTargetIssue(props.schedule(), target);
    if (targetIssue) {
      setActionError(targetIssue);
      return;
    }
    const current = targetWindows(props.schedule(), target);
    if (!checked)
      remembered.set(
        targetKey(target),
        current.map((window) => ({ ...window }))
      );
    const fallback =
      target.kind === 'date'
        ? targetWindows({ ...props.schedule(), overrides: [] }, target)
        : [];
    const windows = checked
      ? (remembered.get(targetKey(target)) ??
        (fallback.length ? fallback : [{ start: '09:00', end: '17:00' }]))
      : [];
    const error = windowsIssue(windows);
    if (error) {
      setActionError(error.message);
      return;
    }
    if (checked) remembered.delete(targetKey(target));
    props.onChange((schedule) => setTargetWindows(schedule, target, windows));
    setNotice(
      checked ? 'Available hours restored.' : 'Day marked unavailable.'
    );
  };
  const remove = (target: AvailabilityTarget, index: number) => {
    if (props.disabled()) return;
    if (target.kind === 'weekly') remembered.delete(targetKey(target));
    props.onChange((schedule) =>
      setTargetWindows(
        schedule,
        target,
        targetWindows(schedule, target).filter((_, i) => i !== index)
      )
    );
    setNotice('Time range removed.');
  };
  const restoreDate = (date: string) => {
    if (props.disabled()) return;
    remembered.delete(date);
    props.onChange((schedule) => ({
      ...schedule,
      overrides: schedule.overrides.filter(
        (override) => override.date !== date
      ),
    }));
    setNotice('Date override removed. Weekly hours apply again.');
  };
  const fixOverlaps = () => {
    if (props.disabled()) return;
    props.onChange((schedule) => ({
      ...schedule,
      weekly: schedule.weekly.map((day) =>
        windowsIssue(day.windows)?.mergeable
          ? { ...day, windows: mergeWindows(day.windows) }
          : day
      ),
      overrides: schedule.overrides.map((override) =>
        windowsIssue(override.windows)?.mergeable
          ? { ...override, windows: mergeWindows(override.windows) }
          : override
      ),
    }));
    setNotice('Overlapping hours merged. Review the schedule before saving.');
  };
  return {
    selection,
    issue,
    actionError,
    notice,
    displayWeeklyWindows,
    displayUnavailableWindows,
    open,
    close,
    updateSelection,
    apply,
    copy,
    toggle,
    remove,
    restoreDate,
    fixOverlaps,
  };
}
