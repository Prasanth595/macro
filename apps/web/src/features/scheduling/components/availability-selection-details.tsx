import CalendarBlank from '@phosphor/calendar-blank.svg';
import Trash from '@phosphor/trash.svg';
import X from '@phosphor/x.svg';
import { Button } from '@ui';
import { Show } from 'solid-js';
import type { AvailabilityIssue } from '../core/availability';
import {
  formatAvailabilityDate,
  formatAvailabilityDateRanges,
} from '../core/availability-month';
import type { AvailabilityHourRange } from '../core/availability-selection';
import { AvailabilityFieldRow } from './availability-field-row';
import { AvailabilityHoursEditor } from './availability-hours-editor';
import { SelectInput } from './fields';

export function AvailabilitySelectionDetails(props: {
  dates: string[];
  draft: { dates: string[]; ranges: AvailabilityHourRange[] | undefined };
  issue?: AvailabilityIssue;
  disabled: boolean;
  hasChanges: boolean;
  onEdit: (dates?: string[]) => void;
  onChange: (ranges: AvailabilityHourRange[]) => void;
  onApply: () => void;
  onClearHours: () => void;
  onClose: () => void;
}) {
  return (
    <section
      aria-label="Selected availability"
      class="flex min-w-0 flex-col gap-4"
    >
      <AvailabilityFieldRow icon={<CalendarBlank />}>
        <div class="flex min-w-0 flex-col gap-4">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h3 class="text-base font-semibold leading-6">Edit hours</h3>
              <p class="mt-1 text-xs leading-relaxed text-ink-muted">
                {formatAvailabilityDateRanges(props.draft.dates)}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                label="Clear selected hours"
                tooltip="Remove all hours on these dates, leaving them blank and non-bookable"
                disabled={props.disabled}
                onClick={props.onClearHours}
              >
                <Trash class="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                label="Close selected dates"
                onClick={props.onClose}
              >
                <X class="size-4" />
              </Button>
            </div>
          </div>
          <Show when={props.dates.length > 1}>
            <SelectInput
              label="Dates to edit"
              value={
                props.draft.dates.length > 1 ? 'all' : props.draft.dates[0]
              }
              options={[
                {
                  value: 'all',
                  label: `All ${props.dates.length} selected dates`,
                },
                ...props.dates.map((date) => ({
                  value: date,
                  label: formatAvailabilityDate(date),
                })),
              ]}
              disabled={props.disabled || props.hasChanges}
              onChange={(date) =>
                props.onEdit(date === 'all' ? undefined : [date])
              }
            />
          </Show>
        </div>
      </AvailabilityFieldRow>
      <AvailabilityHoursEditor
        ranges={props.draft.ranges}
        count={props.draft.dates.length}
        issue={props.issue}
        disabled={props.disabled}
        onChange={props.onChange}
        onApply={props.onApply}
        onCancel={props.onClose}
      />
    </section>
  );
}
