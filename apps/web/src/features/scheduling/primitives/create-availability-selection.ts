import { deepEqual } from '@core/util/compareUtils';
import { type Accessor, batch, createSignal } from 'solid-js';
import {
  type AvailabilityIssue,
  validAvailabilityDate,
} from '../core/availability';
import {
  type AvailabilityHourRange,
  type AvailabilityHours,
  availabilityHourRanges,
  availabilityHoursFromRanges,
  availabilitySelectedDates,
  commonAvailabilityHours,
  normalizeAvailabilityHours,
  replaceAvailabilityDates,
} from '../core/availability-selection';
import type { AvailabilitySchedule } from '../core/types';

export type AvailabilitySelectionDraft = {
  dates: string[];
  ranges: AvailabilityHourRange[] | undefined;
};

/** Selecting dates opens their hours for editing without changing the schedule. */
export function createAvailabilitySelection(props: {
  schedule: Accessor<AvailabilitySchedule>;
  disabled: Accessor<boolean>;
  onChange: (
    update: (current: AvailabilitySchedule) => AvailabilitySchedule
  ) => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [dates, setDates] = createSignal<string[]>([]);
  const [draft, setDraft] = createSignal<AvailabilitySelectionDraft>();
  const [issue, setIssue] = createSignal<AvailabilityIssue>();
  const [notice, setNotice] = createSignal('');
  let initialHours: AvailabilityHours | undefined;
  const selectedDates = () =>
    availabilitySelectedDates(props.schedule(), dates());
  const hasChanges = () => {
    const current = draft();
    return (
      !!current &&
      !deepEqual(
        current.ranges
          ? normalizeAvailabilityHours(
              availabilityHoursFromRanges(current.ranges)
            )
          : undefined,
        initialHours
      )
    );
  };
  const close = () => {
    batch(() => {
      setDraft(undefined);
      setDates([]);
      initialHours = undefined;
      setIssue(undefined);
      props.onEditingChange?.(false);
    });
  };
  const edit = (selected?: string[]) => {
    if (props.disabled() || hasChanges()) return;
    const next = selected ? [...new Set(selected)].sort() : dates();
    if (
      !next.length ||
      next.some(
        (date) => !validAvailabilityDate(date) || !dates().includes(date)
      )
    )
      return;
    const hours = commonAvailabilityHours(
      availabilitySelectedDates(props.schedule(), next)
    );
    initialHours = hours ? normalizeAvailabilityHours(hours) : undefined;
    setDraft({
      dates: [...next],
      ranges: hours ? availabilityHourRanges(hours) : undefined,
    });
    setIssue(undefined);
    setNotice('');
    props.onEditingChange?.(true);
  };
  const select = (selected: string[]) => {
    if (
      props.disabled() ||
      hasChanges() ||
      selected.some((date) => !validAvailabilityDate(date))
    )
      return;
    const next = [...new Set(selected)].sort();
    batch(() => {
      setDates(next);
      if (next.length) edit(next);
      else close();
    });
  };
  const update = (ranges: AvailabilityHourRange[]) => {
    if (props.disabled()) return;
    setDraft((current) =>
      current
        ? {
            ...current,
            ranges: ranges.map((range) => ({ ...range })),
          }
        : current
    );
    setIssue(undefined);
    setNotice('');
  };
  const apply = (): boolean => {
    const current = draft();
    if (!current || props.disabled()) return false;
    if (!current.ranges) {
      setIssue({
        message: 'Choose hours for the selected dates before applying.',
        mergeable: false,
      });
      return false;
    }
    const result = replaceAvailabilityDates(
      props.schedule(),
      current.dates,
      availabilityHoursFromRanges(current.ranges)
    );
    if (!result.ok) {
      setIssue(result.issue);
      return false;
    }
    props.onChange(() => result.schedule);
    close();
    setNotice('Availability updated.');
    return true;
  };
  const clear = (): boolean => {
    const targets = draft()?.dates ?? dates();
    if (props.disabled() || !targets.length) return false;
    const result = replaceAvailabilityDates(props.schedule(), targets, {
      windows: [],
      unavailableWindows: [],
    });
    if (!result.ok) {
      setIssue(result.issue);
      return false;
    }
    props.onChange(() => result.schedule);
    close();
    setNotice(
      'Selected hours cleared. Cleared time is blank and non-bookable.'
    );
    return true;
  };
  return {
    dates,
    selectedDates,
    draft,
    issue,
    notice,
    hasChanges,
    select,
    close,
    edit,
    update,
    apply,
    clear,
  };
}
