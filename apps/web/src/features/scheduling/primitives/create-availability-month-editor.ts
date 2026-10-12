import { type Accessor, createSignal } from 'solid-js';
import {
  type AvailabilityChange,
  type AvailabilityIssue,
  type AvailabilityResult,
  type AvailabilityTarget,
  availabilityConflictIssue,
  validAvailabilityDate,
} from '../core/availability';
import type { AvailabilitySchedule, TimeWindow } from '../core/types';

/** Keep batch selection separate from schedule mutations until explicit Apply. */
export function createAvailabilityMonthEditor(props: {
  schedule: Accessor<AvailabilitySchedule>;
  disabled: Accessor<boolean>;
  unavailable: (date: string) => TimeWindow[];
  copy: (
    change: AvailabilityChange,
    targets: AvailabilityTarget[],
    replaceConflicts: boolean
  ) => AvailabilityResult;
  onEditingChange: (editing: boolean) => void;
}) {
  const [template, setTemplate] = createSignal<AvailabilityChange>();
  const [dates, setDates] = createSignal<string[]>([]);
  const [error, setError] = createSignal<AvailabilityIssue>();
  const begin = (change: AvailabilityChange) => {
    if (props.disabled()) return;
    setTemplate({ ...change, window: { ...change.window } });
    setDates([]);
    setError(undefined);
    props.onEditingChange(true);
  };
  const select = (selected: string[], toggle = false) => {
    if (props.disabled() || !template()) return;
    if (selected.some((date) => !validAvailabilityDate(date))) return;
    setDates((current) => {
      if (toggle && selected.length === 1 && current.includes(selected[0]))
        return current.filter((date) => date !== selected[0]);
      return [...new Set([...current, ...selected])].sort();
    });
    setError(undefined);
  };
  const clear = () => {
    if (props.disabled()) return;
    setDates([]);
    setError(undefined);
  };
  const exit = () => {
    if (props.disabled()) return;
    setTemplate(undefined);
    setDates([]);
    setError(undefined);
    props.onEditingChange(false);
  };
  const conflicts = (change = template(), targets = dates()) =>
    change
      ? targets.flatMap((date) => {
          const issue = availabilityConflictIssue(
            props.schedule(),
            {
              ...change,
              target: { kind: 'date', date },
              origin: undefined,
              index: undefined,
            },
            props.unavailable(date)
          );
          return issue ? [{ date, issue }] : [];
        })
      : [];
  const apply = (replaceConflicts = false) => {
    const change = template();
    if (!change || !dates().length || props.disabled()) return false;
    const result = props.copy(
      change,
      dates().map((date) => ({ kind: 'date', date })),
      replaceConflicts
    );
    if (!result.ok) {
      setError(result.issue);
      return false;
    }
    clear();
    return true;
  };
  return {
    template,
    dates,
    error,
    begin,
    select,
    clear,
    exit,
    conflicts,
    apply,
  };
}
