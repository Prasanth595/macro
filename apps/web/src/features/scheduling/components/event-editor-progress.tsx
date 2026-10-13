import { EVENT_EDITOR_STEPS } from '../core/event-editor';

/** A visual and accessible progress indicator for the booking-link editor. */
export function EventEditorProgress(props: { step: number }) {
  const currentStep = () => EVENT_EDITOR_STEPS[props.step];
  const position = () => props.step + 1;
  const total = EVENT_EDITOR_STEPS.length;
  return (
    <div
      role="progressbar"
      aria-label="Booking setup progress"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={position()}
      aria-valuetext={`Step ${position()} of ${total}: ${currentStep().heading}`}
      aria-live="polite"
      aria-atomic="true"
      class="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-active sm:w-20"
    >
      <div
        aria-hidden="true"
        class="h-full rounded-full bg-accent transition-[width] duration-200 motion-reduce:transition-none"
        style={{ width: `${(position() / total) * 100}%` }}
      />
    </div>
  );
}
