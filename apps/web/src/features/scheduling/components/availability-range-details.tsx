import ArrowCounterClockwise from '@phosphor/arrow-counter-clockwise.svg';
import CalendarBlank from '@phosphor/calendar-blank.svg';
import Clock from '@phosphor/clock.svg';
import Copy from '@phosphor/copy.svg';
import Globe from '@phosphor/globe.svg';
import Pencil from '@phosphor/pencil-simple.svg';
import Repeat from '@phosphor/repeat.svg';
import Trash from '@phosphor/trash.svg';
import X from '@phosphor/x.svg';
import { Button } from '@ui';
import { onMount, Show } from 'solid-js';
import type {
  AvailabilityChange,
  AvailabilityIssue,
} from '../core/availability';
import {
  type AvailabilityTimeFormat,
  availabilityTimeLabel,
  formatAvailabilityDate,
} from '../core/availability-month';
import { AvailabilityRangeEditor } from './availability-range-editor';

export function AvailabilityRangeDetails(props: {
  change: AvailabilityChange;
  timeZone: string;
  timeFormat: AvailabilityTimeFormat;
  date: string;
  inherited: boolean;
  overridden: boolean;
  inactive?: boolean;
  disabled: boolean;
  draft?: AvailabilityChange;
  hasChanges: boolean;
  issue?: AvailabilityIssue;
  onEdit: () => void;
  onRemove: () => void;
  onClear: () => void;
  onRestore: () => void;
  onClose: () => void;
  onCancelEdit: () => void;
  onChange: (
    update: (current: AvailabilityChange) => AvailabilityChange
  ) => void;
  onApply: (replaceConflicts?: boolean) => void;
  onStamp: () => void;
}) {
  let content!: HTMLElement;
  const focusEditor = () =>
    queueMicrotask(() => {
      if (!content.isConnected) return;
      const control =
        content.querySelector<HTMLInputElement>(
          '[aria-label="Availability start time"]'
        ) ??
        content.querySelector<HTMLButtonElement>(
          '[aria-label="Availability type"] button[aria-pressed="true"]'
        );
      control?.focus();
    });
  const focusDetails = () =>
    queueMicrotask(() => {
      if (!content.isConnected) return;
      content
        .querySelector<HTMLButtonElement>(
          '[aria-label="Edit availability"], [aria-label="Edit time off"]'
        )
        ?.focus();
    });
  onMount(() => {
    if (props.draft) focusEditor();
    else focusDetails();
  });
  const unavailable = () => props.change.mode === 'unavailable';
  const targetLabel = () =>
    formatAvailabilityDate(
      props.change.target.kind === 'weekly'
        ? props.date
        : props.change.target.date
    );
  const timeLabel = () =>
    props.change.allDay
      ? 'All day'
      : availabilityTimeLabel(props.change.window, props.timeFormat);
  const closeThen = (callback: () => void) => {
    props.onClose();
    callback();
  };

  return (
    <section
      ref={content}
      aria-label="Availability details"
      class="flex min-h-0 min-w-0 w-full flex-col text-ink"
    >
      <div class="flex shrink-0 items-center justify-between gap-2 pb-3">
        <h3 class="min-w-0 text-base font-semibold leading-6">
          {props.draft
            ? 'Edit availability'
            : unavailable()
              ? 'Unavailable'
              : 'Available'}
        </h3>
        <div class="flex shrink-0 items-center gap-1">
          <Show
            when={
              !props.disabled &&
              (!props.draft || (props.draft.origin && !props.hasChanges))
            }
          >
            <Show when={!props.inactive}>
              <Button
                label="Apply to other days"
                variant="ghost"
                size="icon-sm"
                depth={3}
                class="text-ink-muted [&_svg]:size-4"
                onClick={props.onStamp}
              >
                <Copy />
              </Button>
            </Show>
            <Show when={!props.inactive && !props.draft}>
              <Button
                label={unavailable() ? 'Edit time off' : 'Edit availability'}
                variant="ghost"
                size="icon-sm"
                depth={3}
                class="text-ink-muted [&_svg]:size-4"
                onClick={() => {
                  props.onEdit();
                  focusEditor();
                }}
              >
                <Pencil />
              </Button>
            </Show>
            <Show when={!props.inactive}>
              <Button
                label="Clear range"
                variant="ghost"
                size="icon-sm"
                depth={3}
                class="text-ink-muted [&_svg]:size-4"
                tooltip="Leave this range blank and non-bookable, without time off"
                onClick={props.onClear}
              >
                <Trash />
              </Button>
            </Show>
            <Show
              when={props.overridden && props.change.target.kind === 'date'}
            >
              <Button
                label="Use weekly hours"
                variant="ghost"
                size="icon-sm"
                depth={3}
                class="text-ink-muted [&_svg]:size-4"
                onClick={() => closeThen(props.onRestore)}
              >
                <ArrowCounterClockwise />
              </Button>
            </Show>
          </Show>
          <Button
            label="Close availability details"
            aria-label="Close availability details"
            variant="ghost"
            size="icon-sm"
            depth={3}
            class="rounded-md text-ink-muted [&_svg]:size-4"
            onClick={props.onClose}
          >
            <X />
          </Button>
        </div>
      </div>
      <div class="min-h-0 min-w-0 flex-auto overflow-y-auto overscroll-contain">
        <Show
          when={props.draft}
          fallback={
            <div class="flex flex-col gap-3 text-xs">
              <div class="flex items-start gap-2">
                <CalendarBlank class="size-4 shrink-0 text-ink-muted" />
                <span>{targetLabel()}</span>
              </div>
              <div class="flex items-start gap-2">
                <Clock class="size-4 shrink-0 text-ink-muted" />
                <span>{timeLabel()}</span>
              </div>
              <div class="flex items-start gap-2">
                <Repeat class="size-4 shrink-0 text-ink-muted" />
                <span>
                  {props.change.target.kind === 'weekly'
                    ? 'Repeats every week'
                    : props.inherited
                      ? 'Weekly hours · Editing creates a date override'
                      : 'Specific date'}
                </span>
              </div>
              <div class="flex items-start gap-2">
                <Globe class="size-4 shrink-0 text-ink-muted" />
                <span>{props.timeZone.replaceAll('_', ' ')}</span>
              </div>
              <Show when={props.inactive}>
                <p class="text-xs text-ink-muted">
                  Turn this weekday on to edit its recurring hours.
                </p>
              </Show>
            </div>
          }
        >
          {(draft) => (
            <AvailabilityRangeEditor
              change={draft()}
              timeFormat={props.timeFormat}
              date={props.date}
              issue={props.issue}
              disabled={props.disabled}
              onChange={props.onChange}
              onApply={(replaceConflicts) => {
                props.onApply(replaceConflicts);
                if (!props.draft) focusDetails();
              }}
              onClose={() => {
                props.onCancelEdit();
                focusDetails();
              }}
              onClear={props.onClear}
            />
          )}
        </Show>
      </div>
    </section>
  );
}
