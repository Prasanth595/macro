import { useLocale } from '@kobalte/core/i18n';
import { Slider, Tooltip } from '@ui';
import { createSignal, createUniqueId, For } from 'solid-js';
import { formatBookingNotice } from '../core/booking-notice';
import {
  BOOKING_RANGE_TIMELINE,
  bookingTimelinePosition,
  bookingTimelineValue,
} from '../core/booking-rule-timeline';
import { DAY_UNITS } from '../core/booking-units';
import type { EventType, EventValidationIssue } from '../core/types';
import { BookingNoticeInput } from './booking-notice-input';
import { BookingValueInput } from './booking-value-input';
import { createSliderPointerIntent } from './slider-pointer-intent';

type RangeField = 'noticeMinutes' | 'horizonDays';
const MINUTES_PER_DAY = 1440;
const SLIDER_MAX_DAYS = 30;
const RANGE_MARKS = ['1 hour', '1 day', '7 days'];
const RANGE_DAY_UNITS = DAY_UNITS.slice(0, 1);

/** The displayed scale clips outliers, while exact inputs retain the stored range. */
export function BookingRange(props: {
  draft: EventType;
  disabled: boolean;
  issues?: EventValidationIssue[];
  onUpdate: <K extends keyof EventType>(key: K, value: EventType[K]) => void;
}) {
  const fromId = createUniqueId();
  const toId = createUniqueId();
  const fromErrorId = createUniqueId();
  const toErrorId = createUniqueId();
  const [hovered, setHovered] = createSignal<RangeField>();
  const [focused, setFocused] = createSignal<RangeField>();
  const [dragging, setDragging] = createSignal<RangeField>();
  const { direction } = useLocale();
  let keyboardGesture = false;
  const pointerIntent = createSliderPointerIntent();
  const finishDrag = () => {
    pointerIntent.end();
    setDragging(undefined);
  };
  const tooltipVisible = (field: RangeField) =>
    !props.disabled &&
    (hovered() === field || focused() === field || dragging() === field);
  const error = (field: RangeField) =>
    props.issues?.find((issue) => issue.field === field)?.message;
  const update = (field: RangeField, value: number) => {
    if (!props.disabled) props.onUpdate(field, value);
  };
  const latest = () =>
    Number.isFinite(props.draft.horizonDays)
      ? Math.min(SLIDER_MAX_DAYS, Math.max(1, props.draft.horizonDays))
      : 1;
  const earliest = () =>
    Number.isFinite(props.draft.noticeMinutes)
      ? Math.min(10080, Math.max(0, props.draft.noticeMinutes))
      : 0;
  const positions = () => {
    const last = bookingTimelinePosition(
      latest() * MINUTES_PER_DAY,
      BOOKING_RANGE_TIMELINE
    );
    return [
      Math.min(
        bookingTimelinePosition(earliest(), BOOKING_RANGE_TIMELINE),
        last
      ),
      last,
    ];
  };
  const changeNotice = (value: number) => {
    const horizon = Number.isFinite(props.draft.horizonDays)
      ? props.draft.horizonDays
      : 365;
    update(
      'noticeMinutes',
      Math.max(
        0,
        Math.min(10080, horizon * MINUTES_PER_DAY - 1, Math.round(value))
      )
    );
  };
  const changeHorizon = (value: number) => {
    const notice = Number.isFinite(props.draft.noticeMinutes)
      ? props.draft.noticeMinutes
      : 0;
    update(
      'horizonDays',
      Math.min(
        SLIDER_MAX_DAYS,
        Math.max(1, Math.floor(notice / MINUTES_PER_DAY) + 1, Math.round(value))
      )
    );
  };
  const describeNotice = () => formatBookingNotice(props.draft.noticeMinutes);
  const describeHorizon = () =>
    `${props.draft.horizonDays} ${props.draft.horizonDays === 1 ? 'day' : 'days'}`;
  const horizonLabel = () =>
    props.draft.horizonDays > SLIDER_MAX_DAYS
      ? `30 days+, exact value ${describeHorizon()}`
      : describeHorizon();
  const keyboard = (field: RangeField, event: KeyboardEvent) => {
    if (props.disabled) return;
    const notice = field === 'noticeMinutes';
    const value = notice ? earliest() : latest();
    const increment = event.shiftKey ? (notice ? 60 : 7) : 1;
    const horizontal = direction() === 'rtl' ? -1 : 1;
    const values: Record<string, number> = {
      ArrowLeft: value - increment * horizontal,
      ArrowRight: value + increment * horizontal,
      ArrowDown: value - increment,
      ArrowUp: value + increment,
      PageDown: value - (notice ? 60 : 7),
      PageUp: value + (notice ? 60 : 7),
      Home: notice ? 0 : 1,
      End: notice ? 10080 : SLIDER_MAX_DAYS,
    };
    if (values[event.key] === undefined) return;
    event.preventDefault();
    keyboardGesture = true;
    queueMicrotask(() => {
      keyboardGesture = false;
    });
    if (notice) changeNotice(values[event.key]);
    else changeHorizon(values[event.key]);
  };
  return (
    <section
      aria-label="Meeting times guests can choose"
      class="flex min-w-0 flex-col gap-2"
    >
      <div
        role="group"
        aria-label="Booking range"
        class="flex min-w-0 flex-col gap-1.5"
        data-booking-range
      >
        <Slider
          value={positions()}
          minValue={0}
          maxValue={100}
          step={0.1}
          minStepsBetweenThumbs={0}
          disabled={props.disabled}
          validationState={
            error('noticeMinutes') || error('horizonDays') ? 'invalid' : 'valid'
          }
          class="gap-3"
          onPointerMove={pointerIntent.move}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onLostPointerCapture={finishDrag}
          onChange={(values) => {
            if (
              props.disabled ||
              keyboardGesture ||
              pointerIntent.ignoresChange()
            )
              return;
            const previous = positions();
            if (values[0] !== previous[0])
              changeNotice(
                bookingTimelineValue(values[0], BOOKING_RANGE_TIMELINE)
              );
            else if (values[1] !== previous[1])
              changeHorizon(
                bookingTimelineValue(values[1], BOOKING_RANGE_TIMELINE) /
                  MINUTES_PER_DAY
              );
          }}
        >
          <Slider.Label
            as="h4"
            class="text-sm font-normal tracking-wide text-ink-muted"
          >
            Booking range
          </Slider.Label>
          <div class="flex min-w-0 flex-col gap-1.5" data-booking-range-row>
            <div
              class="flex min-w-0 items-start justify-between gap-2"
              data-booking-range-values
            >
              <div class="min-w-0" data-booking-range-earliest>
                <BookingNoticeInput
                  label="What's the earliest someone can book?"
                  inputId={fromId}
                  value={props.draft.noticeMinutes}
                  min={0}
                  max={10080}
                  disabled={props.disabled}
                  error={error('noticeMinutes')}
                  errorId={fromErrorId}
                  onChange={(value) => update('noticeMinutes', value)}
                />
              </div>
              <div
                class="flex min-w-0 flex-col items-end"
                data-booking-range-latest
              >
                <BookingValueInput
                  label="What's the latest someone can book?"
                  inputId={toId}
                  value={props.draft.horizonDays}
                  min={1}
                  max={365}
                  units={RANGE_DAY_UNITS}
                  compact
                  controls={false}
                  disabled={props.disabled}
                  error={error('horizonDays')}
                  errorId={toErrorId}
                  onChange={(value) => update('horizonDays', value)}
                />
              </div>
            </div>
            <div class="min-w-0" data-booking-range-timeline>
              <Slider.Track
                class="my-2"
                onPointerMove={pointerIntent.move}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onLostPointerCapture={finishDrag}
              >
                <Slider.Fill />
                <Slider.Thumb
                  aria-label="Earliest booking time"
                  aria-valuemin={0}
                  aria-valuemax={10080}
                  aria-valuenow={earliest()}
                  aria-valuetext={describeNotice()}
                  aria-invalid={error('noticeMinutes') ? true : undefined}
                  aria-disabled={props.disabled ? true : undefined}
                  aria-describedby={
                    error('noticeMinutes') ? fromErrorId : undefined
                  }
                  onKeyDown={(event) => keyboard('noticeMinutes', event)}
                  onPointerDown={(event) => {
                    pointerIntent.thumbDown(event);
                    setDragging('noticeMinutes');
                  }}
                  onPointerEnter={() => setHovered('noticeMinutes')}
                  onPointerLeave={() => setHovered(undefined)}
                  onFocus={() => setFocused('noticeMinutes')}
                  onBlur={() => setFocused(undefined)}
                  onPointerMove={pointerIntent.move}
                  onPointerUp={finishDrag}
                  onPointerCancel={finishDrag}
                  onLostPointerCapture={finishDrag}
                  class="border-2 border-accent"
                >
                  <Tooltip
                    label={describeNotice()}
                    open={tooltipVisible('noticeMinutes')}
                    disabled={props.disabled}
                    as="span"
                    class="absolute inset-0"
                  >
                    <span aria-hidden="true" class="block size-full" />
                  </Tooltip>
                </Slider.Thumb>
                <Slider.Thumb
                  aria-label="Latest booking time"
                  aria-valuemin={1}
                  aria-valuemax={SLIDER_MAX_DAYS}
                  aria-valuenow={latest()}
                  aria-valuetext={horizonLabel()}
                  aria-invalid={error('horizonDays') ? true : undefined}
                  aria-disabled={props.disabled ? true : undefined}
                  aria-describedby={
                    error('horizonDays') ? toErrorId : undefined
                  }
                  onKeyDown={(event) => keyboard('horizonDays', event)}
                  onPointerDown={(event) => {
                    pointerIntent.thumbDown(event);
                    setDragging('horizonDays');
                  }}
                  onPointerEnter={() => setHovered('horizonDays')}
                  onPointerLeave={() => setHovered(undefined)}
                  onFocus={() => setFocused('horizonDays')}
                  onBlur={() => setFocused(undefined)}
                  onPointerMove={pointerIntent.move}
                  onPointerUp={finishDrag}
                  onPointerCancel={finishDrag}
                  onLostPointerCapture={finishDrag}
                  class="border-2 border-accent"
                >
                  <Tooltip
                    label={horizonLabel()}
                    open={tooltipVisible('horizonDays')}
                    disabled={props.disabled}
                    as="span"
                    class="absolute inset-0"
                  >
                    <span aria-hidden="true" class="block size-full" />
                  </Tooltip>
                </Slider.Thumb>
              </Slider.Track>
              <div
                class="relative h-4 text-[10px] text-ink-muted"
                aria-hidden="true"
              >
                <For each={RANGE_MARKS}>
                  {(mark, index) => (
                    <span
                      class="absolute -translate-x-1/2 rtl:translate-x-1/2"
                      style={{ 'inset-inline-start': `${(index() + 1) * 25}%` }}
                    >
                      {mark}
                    </span>
                  )}
                </For>
              </div>
            </div>
          </div>
        </Slider>
      </div>
    </section>
  );
}
