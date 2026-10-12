import { Slider } from '@ui';
import { tooltipClasses } from '@ui/components/Tooltip';
import { createSignal, createUniqueId, Show } from 'solid-js';
import {
  type BookingValueUnit,
  describeBookingValue,
} from '../core/booking-units';
import { BookingFieldInfo } from './booking-field-info';
import {
  type BookingPreset,
  BookingPresets,
  focusExactValue,
} from './booking-rule-value';
import { BookingValueInput } from './booking-value-input';

export function BookingValueSlider(props: {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  units?: readonly BookingValueUnit[];
  sliderStep?: number;
  disabled: boolean;
  error?: string;
  presets?: BookingPreset[];
  onCustom?: () => void;
  onChange: (value: number) => void;
}) {
  const [manual, setManual] = createSignal(false);
  const errorId = createUniqueId();
  const tooltipId = createUniqueId();
  const [fine, setFine] = createSignal(false);
  const [hovered, setHovered] = createSignal(false);
  const [focused, setFocused] = createSignal(false);
  const [dragging, setDragging] = createSignal(false);
  const updateFine = (event: KeyboardEvent | PointerEvent) =>
    setFine(event.ctrlKey);
  const startDrag = (event: PointerEvent) => {
    updateFine(event);
    setDragging(true);
  };
  const finishDrag = () => {
    setDragging(false);
    setFine(false);
  };
  const tooltipVisible = () =>
    !props.disabled && custom() && (hovered() || focused() || dragging());
  let exactInput: HTMLInputElement | undefined;
  const selectCustom = () => {
    props.onCustom?.();
    setManual(true);
    focusExactValue(() => exactInput);
  };
  const custom = () =>
    manual() ||
    !(props.presets ?? []).some((preset) => preset.value === props.value);
  const units = () =>
    props.units ?? [
      { id: props.unit, label: props.unit, short: props.unit, factor: 1 },
    ];
  // Anchor the gesture grid to step multiples without rounding the displayed value.
  const sliderMinimum = () =>
    Math.floor(props.min / (props.sliderStep ?? 1)) * (props.sliderStep ?? 1);
  const sliderValue = () =>
    Math.min(
      props.max,
      Math.max(
        props.min,
        Number.isFinite(props.value) ? props.value : props.min
      )
    );
  const tooltipValue = () => {
    const value = sliderValue();
    const hasHourUnit = units().some(
      (unit) => unit.id === 'hours' && unit.factor === 60
    );
    if (props.unit === 'min' && hasHourUnit && value >= 60) {
      const hours = Math.floor(value / 60);
      const remainingMinutes = value % 60;
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}${
        remainingMinutes
          ? ` ${remainingMinutes} ${remainingMinutes === 1 ? 'min' : 'mins'}`
          : ''
      }`;
    }
    return `${value} ${props.unit}`;
  };
  return (
    <Slider
      value={[sliderValue()]}
      minValue={sliderMinimum()}
      maxValue={props.max}
      step={fine() ? 1 : (props.sliderStep ?? 1)}
      disabled={props.disabled}
      validationState={props.error ? 'invalid' : 'valid'}
      aria-describedby={props.error ? errorId : undefined}
      onChange={(values) => {
        setManual(true);
        const value = Math.min(props.max, Math.max(props.min, values[0]));
        if (value !== props.value) props.onChange(value);
      }}
    >
      <div class="flex flex-col items-start gap-2">
        <div class="flex items-center gap-1">
          <Slider.Label class="text-base font-medium">
            {props.label}
          </Slider.Label>
          <Show when={props.description}>
            {(description) => (
              <BookingFieldInfo
                label={props.label}
                description={description()}
              />
            )}
          </Show>
        </div>
      </div>
      <Show when={props.presets}>
        <BookingPresets
          label={props.label}
          value={props.value}
          custom={custom()}
          disabled={props.disabled}
          presets={props.presets ?? []}
          onChange={(value) => {
            setManual(false);
            props.onChange(value);
          }}
          onCustom={selectCustom}
        />
      </Show>
      <Show when={(props.sliderStep ?? 1) > 1}>
        <Slider.Description class="sr-only">
          Hold Ctrl for one-minute adjustments.
        </Slider.Description>
      </Show>
      <Show when={custom()}>
        <Slider.Track
          aria-invalid={props.error ? true : undefined}
          class="mb-5 aria-invalid:ring-2 aria-invalid:ring-failure/30"
          onPointerDown={startDrag}
          onPointerMove={updateFine}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onLostPointerCapture={finishDrag}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        >
          <Slider.Fill />
          <Slider.Thumb
            aria-valuemin={props.min}
            aria-valuetext={describeBookingValue(sliderValue(), units())}
            aria-describedby={
              [
                props.error ? errorId : undefined,
                tooltipVisible() ? tooltipId : undefined,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
            onKeyDown={updateFine}
            onKeyUp={updateFine}
            onPointerDown={startDrag}
            onPointerMove={updateFine}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onLostPointerCapture={finishDrag}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setFine(false);
            }}
          >
            {/* Keep off-grid saved values exact in the native range as well. */}
            <Slider.Input min={props.min} step={1} />
          </Slider.Thumb>
          <Show when={tooltipVisible()}>
            <span
              id={tooltipId}
              role="tooltip"
              class={tooltipClasses({
                class:
                  'pointer-events-none absolute top-full z-tool-tip mt-1 -translate-x-1/2 whitespace-nowrap rtl:translate-x-1/2',
              })}
              style={{
                'inset-inline-start': `clamp(3rem,${((sliderValue() - sliderMinimum()) / (props.max - sliderMinimum())) * 100}%,calc(100% - 3rem))`,
              }}
            >
              {tooltipValue()}
            </span>
          </Show>
        </Slider.Track>
        <BookingValueInput
          inputRef={(element) => {
            exactInput = element;
          }}
          label={props.label}
          value={props.value}
          min={props.min}
          max={props.max}
          units={units()}
          disabled={props.disabled}
          error={props.error}
          errorId={errorId}
          onEdit={() => setManual(true)}
          onChange={props.onChange}
        />
      </Show>
    </Slider>
  );
}

export { BookingRules as BookingRuleSliders } from './booking-rules';
