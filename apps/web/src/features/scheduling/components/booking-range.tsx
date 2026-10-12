import { createUniqueId } from 'solid-js';
import { DAY_UNITS, NOTICE_UNITS } from '../core/booking-units';
import type { EventType, EventValidationIssue } from '../core/types';
import { BookingValueInput } from './booking-value-input';

type RangeField = 'noticeMinutes' | 'horizonDays';

export function BookingRange(props: {
  draft: EventType;
  disabled: boolean;
  issues?: EventValidationIssue[];
  onUpdate: <K extends keyof EventType>(key: K, value: EventType[K]) => void;
}) {
  const fromId = createUniqueId();
  const toId = createUniqueId();
  const descriptionId = createUniqueId();
  const error = (field: RangeField) =>
    props.issues?.find((issue) => issue.field === field)?.message;
  const update = (field: RangeField, value: number) => {
    if (!props.disabled) props.onUpdate(field, value);
  };
  return (
    <section
      aria-label="Meeting times guests can choose"
      class="flex min-w-0 flex-col gap-2"
    >
      <div
        role="group"
        aria-label="Booking range"
        aria-describedby={descriptionId}
        class="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-3"
        data-booking-range
      >
        <div class="flex min-w-0 flex-col gap-1.5">
          <label for={fromId} class="text-base font-medium leading-snug">
            What&apos;s the earliest someone can book?
          </label>
          <BookingValueInput
            label="What's the earliest someone can book?"
            inputId={fromId}
            value={props.draft.noticeMinutes}
            min={0}
            max={10080}
            units={NOTICE_UNITS}
            compact
            disabled={props.disabled}
            error={error('noticeMinutes')}
            onChange={(value) => update('noticeMinutes', value)}
          />
        </div>
        <div class="flex min-w-0 flex-col gap-1.5">
          <label for={toId} class="text-base font-medium leading-snug">
            What&apos;s the latest someone can book?
          </label>
          <BookingValueInput
            label="What's the latest someone can book?"
            inputId={toId}
            value={props.draft.horizonDays}
            min={1}
            max={365}
            units={DAY_UNITS}
            compact
            disabled={props.disabled}
            error={error('horizonDays')}
            onChange={(value) => update('horizonDays', value)}
          />
        </div>
      </div>
      <p id={descriptionId} class="text-xs text-ink-muted">
        Guests can choose any available time between these limits, measured from
        now.
      </p>
    </section>
  );
}
