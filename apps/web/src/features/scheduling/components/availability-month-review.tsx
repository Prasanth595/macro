import { Button } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import type {
  AvailabilityChange,
  AvailabilityIssue,
} from '../core/availability';
import {
  type AvailabilityTimeFormat,
  availabilityTimeLabel,
  formatAvailabilityDateRanges,
} from '../core/availability-month';
import { CheckField } from './fields';

export function AvailabilityMonthReview(props: {
  template: AvailabilityChange;
  timeFormat: AvailabilityTimeFormat;
  dates: string[];
  conflicts: { date: string; issue: AvailabilityIssue }[];
  error?: AvailabilityIssue;
  disabled: boolean;
  onClear: () => void;
  onExit: () => void;
  onApply: (replaceConflicts: boolean) => void;
}) {
  const [approval, setApproval] = createSignal('');
  const signature = () =>
    JSON.stringify([
      props.dates,
      props.template.mode,
      props.template.window,
      props.template.allDay,
      props.conflicts,
    ]);
  const approved = () => approval() === signature();
  return (
    <section
      aria-label="Availability stamp review"
      class="shrink-0 rounded-lg border border-accent bg-panel p-3"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">Apply to other days</h3>
          <p class="mt-1 text-xs text-ink-muted">
            {props.template.mode === 'available' ? 'Available' : 'Unavailable'}{' '}
            ·{' '}
            {props.template.allDay
              ? 'All day'
              : availabilityTimeLabel(props.template.window, props.timeFormat)}
          </p>
          <p class="mt-1 text-xs text-ink-muted">
            Click or drag dates to preview. Nothing changes until you Apply.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={props.disabled}
          onClick={props.onExit}
        >
          Exit stamp mode
        </Button>
      </div>
      <div class="mt-3 max-h-20 overflow-y-auto text-xs text-ink-muted">
        <Show
          when={props.dates.length}
          fallback={<span class="text-ink-extra-muted">No dates selected</span>}
        >
          <p>{formatAvailabilityDateRanges(props.dates)}</p>
        </Show>
      </div>
      <Show when={props.conflicts.length}>
        <div
          role="alert"
          class="mt-3 max-h-20 overflow-y-auto text-xs text-failure"
        >
          <For each={props.conflicts}>
            {(conflict) => (
              <p>
                {conflict.date}: {conflict.issue.message}
              </p>
            )}
          </For>
        </div>
        <div class="mt-3">
          <CheckField
            label="Replace conflicting hours"
            class="text-xs"
            disabled={props.disabled}
            checked={approved()}
            onChange={(checked) => setApproval(checked ? signature() : '')}
          />
        </div>
      </Show>
      <Show when={props.error}>
        <p role="alert" class="mt-2 text-xs text-failure">
          {props.error?.message}
        </p>
      </Show>
      <div class="mt-3 flex flex-wrap justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={props.disabled || !props.dates.length}
          onClick={props.onClear}
        >
          Clear selection
        </Button>
        <Button
          variant="cta"
          size="sm"
          disabled={
            props.disabled ||
            !props.dates.length ||
            (!!props.conflicts.length && !approved())
          }
          onClick={() => props.onApply(!!props.conflicts.length && approved())}
        >
          Apply to {props.dates.length}{' '}
          {props.dates.length === 1 ? 'day' : 'days'}
        </Button>
      </div>
    </section>
  );
}
