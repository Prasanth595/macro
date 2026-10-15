import { Collapsible } from '@kobalte/core/collapsible';
import CalendarBlank from '@phosphor/calendar-blank.svg';
import CaretDown from '@phosphor/caret-down.svg';
import X from '@phosphor/x.svg';
import { Button } from '@ui';
import { For } from 'solid-js';
import { validAvailabilityDate } from '../core/availability';
import { formatAvailabilityDate } from '../core/availability-month';
import type { AvailabilitySchedule } from '../core/types';

export function AvailabilityDateOverrides(props: {
  overrides: AvailabilitySchedule['overrides'];
  disabled: boolean;
  onSelect: (date: string, anchor: HTMLElement) => void;
  onRemove: (date: string) => void;
}) {
  return (
    <Collapsible class="min-w-0 border-t border-edge-muted pt-4">
      <Collapsible.Trigger class="group flex min-h-9 w-full items-center gap-2 rounded-md text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <CalendarBlank
          class="size-4 shrink-0 text-ink-extra-muted"
          aria-hidden="true"
        />
        <span class="flex-1">Date overrides</span>
        <span class="text-xs tabular-nums text-ink-muted">
          {props.overrides.length}
        </span>
        <CaretDown class="size-4 shrink-0 text-ink-muted group-data-expanded:rotate-180" />
      </Collapsible.Trigger>
      <Collapsible.Content>
        <section
          aria-label="Saved date overrides"
          class="mt-2 flex max-h-56 min-w-0 flex-col gap-1 overflow-y-auto overscroll-contain"
        >
          <For
            each={[...props.overrides].sort((a, b) =>
              a.date.localeCompare(b.date)
            )}
            fallback={
              <p class="py-2 text-xs leading-relaxed text-ink-muted">
                No date overrides. Select a date on the calendar to set custom
                hours or time off.
              </p>
            }
          >
            {(override) => (
              <div class="flex min-w-0 items-center gap-1 rounded-md border border-edge-muted">
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-auto min-w-0 flex-1 flex-col items-start gap-0.5 py-2 text-left"
                  disabled={
                    props.disabled || !validAvailabilityDate(override.date)
                  }
                  onClick={(event) =>
                    props.onSelect(override.date, event.currentTarget)
                  }
                >
                  <span class="whitespace-normal text-xs">
                    {formatAvailabilityDate(override.date) || 'Choose a date'}
                  </span>
                  <span class="text-xs text-ink-muted">
                    {override.windows.length
                      ? `${override.windows.length} ${override.windows.length === 1 ? 'range' : 'ranges'}`
                      : override.unavailableWindows?.length === 0
                        ? 'Unset'
                        : 'Unavailable'}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  label={`Remove override ${formatAvailabilityDate(override.date)}`}
                  disabled={props.disabled}
                  onClick={() => props.onRemove(override.date)}
                >
                  <X class="size-3" />
                </Button>
              </div>
            )}
          </For>
        </section>
      </Collapsible.Content>
    </Collapsible>
  );
}
