import CalendarBlank from '@phosphor/calendar-blank.svg';
import Clock from '@phosphor/clock.svg';
import Globe from '@phosphor/globe.svg';
import Trash from '@phosphor/trash.svg';
import { Button, Tabs } from '@ui';
import type { AvailabilityTimeFormat } from '../core/availability-month';
import { AvailabilityFieldRow } from './availability-field-row';
import { Field, TextInput, TimeZoneInput } from './fields';

export function AvailabilityScheduleTitle(props: {
  name: string;
  disabled: boolean;
  onChange: (name: string) => void;
}) {
  return (
    <AvailabilityFieldRow icon={<CalendarBlank />} align="center">
      <TextInput
        aria-label="Schedule name"
        placeholder="Schedule name"
        class="h-auto min-w-0 rounded-md border-transparent bg-transparent px-0 py-0.5 text-2xl font-semibold shadow-none focus-visible:border-transparent"
        required
        maxLength={100}
        value={props.name}
        disabled={props.disabled}
        onInput={(event) => props.onChange(event.currentTarget.value)}
      />
    </AvailabilityFieldRow>
  );
}
export function AvailabilityGeneralDetails(props: {
  timeZone: string;
  timeFormat: AvailabilityTimeFormat;
  disabled: boolean;
  timeZoneDisabled: boolean;
  onTimeZoneChange: (timeZone: string) => void;
  onTimeFormatChange: (format: AvailabilityTimeFormat) => void;
  onClear: () => void;
}) {
  return (
    <section aria-label="General details" class="flex min-w-0 flex-col gap-6">
      <AvailabilityFieldRow icon={<Globe />}>
        <Field label="Time zone" labelClass="text-base leading-6">
          <TimeZoneInput
            value={props.timeZone}
            disabled={props.timeZoneDisabled}
            onChange={props.onTimeZoneChange}
          />
        </Field>
      </AvailabilityFieldRow>
      <AvailabilityFieldRow icon={<Clock />}>
        <Field label="Time format" labelClass="text-base leading-6">
          <Tabs
            aria-label="Time format"
            list={[
              { value: '12h', label: '12h' },
              { value: '24h', label: '24h' },
            ]}
            value={props.timeFormat}
            onChange={(value) => {
              if (value === '12h' || value === '24h')
                props.onTimeFormatChange(value);
            }}
          />
        </Field>
      </AvailabilityFieldRow>
      <div class="flex min-w-0 flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          class="justify-start px-0 text-xs text-failure not-touch:not-disabled:hover:text-failure"
          tooltip="Clear all weekly hours and date overrides from this draft. Save to apply."
          disabled={props.disabled}
          onClick={props.onClear}
        >
          <Trash class="size-5" />
          Clear availability
        </Button>
      </div>
    </section>
  );
}
