import { InputGroup } from '@ui';
import { batch, createSignal, createUniqueId } from 'solid-js';
import {
  formatBookingNotice,
  parseBookingNotice,
} from '../core/booking-notice';
import { FieldError } from './fields';

/** A single exact notice field accepts whole hours and minutes without a unit menu. */
export function BookingNoticeInput(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  inputId?: string;
  error?: string;
  errorId?: string;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = createSignal<string>();
  const hintId = createUniqueId();
  const generatedErrorId = createUniqueId();
  const errorId = () => props.errorId ?? generatedErrorId;
  const text = () => editing() ?? formatBookingNotice(props.value);
  const changeText = (text: string) => {
    if (props.disabled) return;
    const value = parseBookingNotice(text);
    batch(() => {
      setEditing(text);
      if (
        value !== undefined &&
        value >= props.min &&
        value <= props.max &&
        value !== props.value
      )
        props.onChange(value);
    });
  };
  return (
    <div class="flex min-w-0 flex-col items-start gap-1.5">
      <InputGroup
        size="lg"
        class="w-auto max-w-full"
        data-number-unit-input
        data-booking-notice-input
      >
        <InputGroup.Input
          id={props.inputId}
          type="text"
          required
          disabled={props.disabled}
          aria-label={`${props.label} exact value`}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={[hintId, props.error ? errorId() : undefined]
            .filter(Boolean)
            .join(' ')}
          value={text()}
          class="flex-none px-3 text-base sm:text-sm"
          style={{
            width: `calc(${Math.min(12, Math.max(5, text().length))}ch + 1.5rem)`,
          }}
          onInput={(event) => changeText(event.currentTarget.value)}
          onFocus={(event) => setEditing(event.currentTarget.value)}
          onBlur={() => setEditing(undefined)}
        />
      </InputGroup>
      <span id={hintId} class="sr-only">
        Enter whole hours and minutes, for example 1 h, 30 m. Numbers without
        units mean minutes.
      </span>
      <FieldError id={errorId()} message={props.error} />
    </div>
  );
}
