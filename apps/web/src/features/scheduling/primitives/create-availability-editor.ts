import { deepEqual } from '@core/util/compareUtils';
import { type Accessor, createSignal } from 'solid-js';
import {
  type AvailabilityChange,
  type AvailabilityIssue,
  type AvailabilityResult,
  type AvailabilityState,
  type AvailabilityTarget,
  applyAvailabilityChange,
  availabilityConflictIssue,
  calendarUnavailableWindows,
  clearAvailabilityRange,
  copyAvailability,
  mergeWindows,
  setAvailabilityState,
  targetWindows,
  windowsIssue,
} from '../core/availability';
import {
  type AvailabilitySchedule,
  MAX_UNAVAILABLE_WINDOWS,
  type TimeWindow,
} from '../core/types';

export function createAvailabilityEditor(props: {
  schedule: Accessor<AvailabilitySchedule>;
  disabled: Accessor<boolean>;
  onEditingChange?: (editing: boolean) => void;
  onChange: (
    update: (current: AvailabilitySchedule) => AvailabilitySchedule
  ) => void;
}) {
  const [selection, setSelection] = createSignal<AvailabilityChange>();
  let initialSelection: AvailabilityChange | undefined;
  const hasChanges = () => {
    const current = selection();
    return !!current && !deepEqual(current, initialSelection);
  };
  const [validationIssue, setIssue] = createSignal<AvailabilityIssue>();
  const [notice, setNotice] = createSignal('');
  const [actionError, setActionError] = createSignal('');
  const displayWeeklyWindows = (day: number) =>
    targetWindows(props.schedule(), { kind: 'weekly', day });
  const displayUnavailableWindows = (date: string) =>
    calendarUnavailableWindows(props.schedule(), date);
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
  const open = (change: AvailabilityChange) => {
    if (props.disabled()) return;
    setActionError('');
    props.onEditingChange?.(true);
    setIssue(undefined);
    setNotice('');
    initialSelection = {
      ...change,
      allDay: !!change.allDay,
      window: { ...change.window },
      origin: change.origin
        ? { ...change.origin, window: { ...change.origin.window } }
        : undefined,
    };
    setSelection(initialSelection);
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
    const result = applyAvailabilityChange(
      props.schedule(),
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
    props.onChange(() => result.schedule);
    close();
    setNotice(
      current.mode === 'unavailable'
        ? 'Time off updated.'
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
    const unavailableByDate = new Map(
      targets.flatMap((target) =>
        target.kind === 'date'
          ? [[target.date, displayUnavailableWindows(target.date)] as const]
          : []
      )
    );
    const result = copyAvailability(
      props.schedule(),
      change,
      targets,
      replaceConflicts,
      unavailableByDate
    );
    if (result.ok) {
      props.onChange(() => result.schedule);
      setNotice(
        `Copied to ${targets.length} ${targets.length === 1 ? 'day' : 'days'}.`
      );
    }
    return result;
  };
  const setState = (target: AvailabilityTarget, state: AvailabilityState) => {
    if (props.disabled()) return;
    setActionError('');
    const result = setAvailabilityState(props.schedule(), target, state);
    if (!result.ok) {
      setActionError(result.issue.message);
      return;
    }
    props.onChange(() => result.schedule);
    setNotice(
      state === 'unset'
        ? 'Hours cleared. This day is blank and non-bookable.'
        : `Day marked ${state}.`
    );
  };
  const clearRanges = (targets: AvailabilityTarget[], window?: TimeWindow) => {
    if (props.disabled()) return false;
    setActionError('');
    let next = props.schedule();
    for (const target of targets) {
      const result = clearAvailabilityRange(next, target, window);
      if (!result.ok) {
        setActionError(result.issue.message);
        return false;
      }
      next = result.schedule;
    }
    props.onChange(() => next);
    close();
    setNotice(
      'Selected hours cleared. Cleared time is blank and non-bookable.'
    );
    return true;
  };
  const remove = (target: AvailabilityTarget, index: number) => {
    const window = targetWindows(props.schedule(), target)[index];
    if (window) clearRanges([target], window);
  };
  const restoreDate = (date: string) => {
    if (props.disabled()) return;
    props.onChange((schedule) => ({
      ...schedule,
      overrides: schedule.overrides.filter(
        (override) => override.date !== date
      ),
    }));
    setNotice('Date override removed. Weekly hours apply again.');
  };
  const clear = () => {
    if (props.disabled()) return;
    close();
    setActionError('');
    props.onChange((schedule) => ({
      ...schedule,
      weekly: schedule.weekly.map((day) => ({
        ...day,
        windows: [],
        unavailableWindows: [],
      })),
      overrides: [],
    }));
    setNotice('Availability cleared. Save the schedule to apply this change.');
  };
  const mergeDay = <
    T extends {
      windows: TimeWindow[];
      unavailableWindows?: TimeWindow[] | null;
    },
  >(
    day: T
  ): T => ({
    ...day,
    windows: windowsIssue(day.windows)?.mergeable
      ? mergeWindows(day.windows)
      : day.windows,
    ...(day.unavailableWindows != null
      ? {
          unavailableWindows: windowsIssue(
            day.unavailableWindows,
            MAX_UNAVAILABLE_WINDOWS
          )?.mergeable
            ? mergeWindows(day.unavailableWindows)
            : day.unavailableWindows,
        }
      : {}),
  });
  const fixOverlaps = () => {
    if (props.disabled()) return;
    props.onChange((schedule) => ({
      ...schedule,
      weekly: schedule.weekly.map(mergeDay),
      overrides: schedule.overrides.map(mergeDay),
    }));
    setNotice('Overlapping hours merged. Review the schedule before saving.');
  };
  return {
    selection,
    hasChanges,
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
    setState,
    clearRanges,
    // Retained until the weekday header consumes the three-state controls.
    toggle: (target: AvailabilityTarget, checked: boolean) =>
      setState(target, checked ? 'available' : 'unavailable'),
    clear,
    remove,
    restoreDate,
    fixOverlaps,
  };
}
