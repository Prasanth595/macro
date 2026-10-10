import { Popover } from '@kobalte/core/popover';
import ArrowCounterClockwise from '@phosphor/arrow-counter-clockwise.svg';
import CalendarBlank from '@phosphor/calendar-blank.svg';
import Clock from '@phosphor/clock.svg';
import Copy from '@phosphor/copy.svg';
import Globe from '@phosphor/globe.svg';
import Pencil from '@phosphor/pencil-simple.svg';
import Repeat from '@phosphor/repeat.svg';
import Trash from '@phosphor/trash.svg';
import X from '@phosphor/x.svg';
import { Button, Layer } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import type {
  AvailabilityChange,
  AvailabilityIssue,
  AvailabilityResult,
  AvailabilityTarget,
} from '../core/availability';
import { dateWeekday } from '../core/availability';
import { WEEKDAYS } from '../core/types';
import { AvailabilityRangeEditor } from './availability-range-editor';
import { CheckField, TextInput } from './fields';

export function AvailabilityRangePopover(props: {
  anchor: HTMLElement;
  addTrigger: HTMLElement;
  boundary: HTMLElement;
  getAnchorRect?: () =>
    | { x: number; y: number; width: number; height: number }
    | undefined;
  change: AvailabilityChange;
  timeZone: string;
  date: string;
  inherited: boolean;
  overridden: boolean;
  inactive?: boolean;
  disabled: boolean;
  draft?: AvailabilityChange;
  issue?: AvailabilityIssue;
  onEdit: () => void;
  onRemove: () => void;
  onRestore: () => void;
  onClose: () => void;
  onCancelEdit: () => void;
  onChange: (
    update: (current: AvailabilityChange) => AvailabilityChange
  ) => void;
  onApply: (replaceConflicts?: boolean) => void;
  onCopy: (
    targets: AvailabilityTarget[],
    replaceConflicts: boolean
  ) => AvailabilityResult;
}) {
  const [copying, setCopying] = createSignal(false);
  const [days, setDays] = createSignal<number[]>([]);
  const [date, setDate] = createSignal('');
  const [copyIssue, setCopyIssue] = createSignal<AvailabilityIssue>();
  let content!: HTMLDivElement;
  const focusFallback = props.anchor.closest<HTMLElement>(
    '[data-availability-day]'
  );
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
          '[aria-label="Edit availability"], [aria-label="Edit time off"], [aria-label="Make available"]'
        )
        ?.focus();
    });
  const unavailable = () => props.change.mode === 'unavailable';
  const targetLabel = () =>
    props.change.target.kind === 'weekly'
      ? `${WEEKDAYS[props.change.target.day]}, ${props.date}`
      : `${WEEKDAYS[dateWeekday(props.change.target.date)]}, ${props.change.target.date}`;
  const timeLabel = () =>
    props.change.allDay
      ? 'All day'
      : `${props.change.window.start}–${props.change.window.end}`;
  const copy = (merge: boolean) => {
    const targets: AvailabilityTarget[] =
      props.change.target.kind === 'weekly'
        ? days().map((day) => ({ kind: 'weekly', day }))
        : [{ kind: 'date', date: date() }];
    const result = props.onCopy(targets, merge);
    if (!result.ok) setCopyIssue(result.issue);
    else props.onClose();
  };
  const closeThen = (callback: () => void) => {
    props.onClose();
    callback();
  };

  return (
    <Popover
      anchorRef={() => props.anchor}
      getAnchorRect={props.getAnchorRect}
      boundary={() => props.boundary}
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      placement="right-start"
      gutter={8}
      flip
      slide
      overlap
      fitViewport
      modal={false}
    >
      <Popover.Portal mount={props.boundary}>
        <Layer depth={3}>
          <Popover.Content
            ref={content}
            class="portal-scope z-modal max-w-[var(--kb-popper-content-available-width)] outline-none"
            excludedElements={[
              () => props.addTrigger,
              // Disabled Save must not become enabled midway through this gesture.
              () =>
                props.draft
                  ? (props.boundary
                      .closest('form')
                      ?.querySelector<HTMLElement>('[data-save-schedule]') ??
                    undefined)
                  : undefined,
            ]}
            onPointerDownOutside={(event) => {
              const pointer = event.detail.originalEvent;
              if (
                pointer.target instanceof Element &&
                pointer.target.closest('[aria-label="Availability calendar"]')
              )
                pointer.preventDefault();
            }}
            onCloseAutoFocus={(event) => {
              const restoreFocus = !event.defaultPrevented;
              event.preventDefault();
              if (!restoreFocus) return;
              if (props.anchor.isConnected)
                props.anchor.focus({ preventScroll: true });
              else focusFallback?.focus({ preventScroll: true });
            }}
          >
            <Popover.Arrow class="fill-menu-glass" />
            <div class="flex max-h-[min(32rem,var(--kb-popper-content-available-height,32rem))] w-fit min-w-[min(22rem,var(--kb-popper-content-available-width,22rem),calc(100cqw-1rem),calc(100vw-1rem))] max-w-[min(26rem,var(--kb-popper-content-available-width,26rem),calc(100cqw-1rem),calc(100vw-1rem))] flex-col overflow-hidden rounded-xl glass bg-menu-glass text-ink">
              <Popover.Title class="sr-only">
                {props.draft
                  ? 'Edit availability'
                  : `${targetLabel()} availability`}
              </Popover.Title>
              <div class="flex shrink-0 items-center justify-end gap-2 px-3 pt-3 pb-2">
                <Show when={!props.draft && !props.disabled}>
                  <Button
                    label="Copy availability"
                    variant="ghost"
                    size="icon-sm"
                    depth={3}
                    class="text-ink-muted [&_svg]:size-4"
                    onClick={() => {
                      setCopying(!copying());
                      setCopyIssue(undefined);
                    }}
                  >
                    <Copy />
                  </Button>
                  <Show when={!props.inactive}>
                    <Button
                      label={
                        unavailable()
                          ? props.change.allDay
                            ? 'Make available'
                            : 'Edit time off'
                          : 'Edit availability'
                      }
                      variant="ghost"
                      size="icon-sm"
                      depth={3}
                      class="text-ink-muted [&_svg]:size-4"
                      onClick={() => {
                        setCopying(false);
                        setCopyIssue(undefined);
                        props.onEdit();
                        focusEditor();
                      }}
                    >
                      <Pencil />
                    </Button>
                  </Show>
                  <Show
                    when={
                      !props.inactive &&
                      (!props.inherited ||
                        props.change.target.kind === 'weekly') &&
                      !unavailable()
                    }
                  >
                    <Button
                      label="Remove availability"
                      variant="ghost"
                      size="icon-sm"
                      depth={3}
                      class="text-ink-muted [&_svg]:size-4"
                      onClick={() => closeThen(props.onRemove)}
                    >
                      <Trash />
                    </Button>
                  </Show>
                  <Show
                    when={
                      props.overridden && props.change.target.kind === 'date'
                    }
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
                <Popover.CloseButton
                  as={Button}
                  label="Close availability details"
                  aria-label="Close availability details"
                  variant="ghost"
                  size="icon-sm"
                  depth={3}
                  class="rounded-md text-ink-muted [&_svg]:size-4"
                >
                  <X />
                </Popover.CloseButton>
              </div>
              <div class="min-h-0 flex-auto overflow-y-auto overscroll-contain px-5 pb-5">
                <Show
                  when={props.draft}
                  fallback={
                    <>
                      <p class="mb-3 text-sm font-semibold">
                        {unavailable() ? 'Unavailable' : 'Available'}
                      </p>
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
                      </div>
                      <Show when={props.inactive}>
                        <p class="mt-3 text-xs text-ink-muted">
                          Turn this weekday on to edit its recurring hours.
                        </p>
                      </Show>
                      <Show when={copying()}>
                        <div class="mt-3 border-t border-edge-muted pt-3">
                          <p class="mb-3 text-xs font-semibold">
                            Copy {unavailable() ? 'time off' : 'this range'} to
                          </p>
                          <Show
                            when={props.change.target.kind === 'weekly'}
                            fallback={
                              <TextInput
                                type="date"
                                aria-label="Copy to date"
                                class="h-8 text-xs"
                                value={date()}
                                onInput={(event) => {
                                  setDate(event.currentTarget.value);
                                  setCopyIssue(undefined);
                                }}
                              />
                            }
                          >
                            <div class="grid grid-cols-2 gap-2">
                              <For
                                each={WEEKDAYS.map((label, day) => ({
                                  label,
                                  day,
                                })).filter(
                                  (item) =>
                                    props.change.target.kind !== 'weekly' ||
                                    item.day !== props.change.target.day
                                )}
                              >
                                {(item) => (
                                  <CheckField
                                    label={item.label}
                                    class="text-xs"
                                    checked={days().includes(item.day)}
                                    onChange={(checked) => {
                                      setDays((current) =>
                                        checked
                                          ? [...current, item.day]
                                          : current.filter(
                                              (day) => day !== item.day
                                            )
                                      );
                                      setCopyIssue(undefined);
                                    }}
                                  />
                                )}
                              </For>
                            </div>
                          </Show>
                          <p class="mt-2 text-xs text-ink-muted">
                            {unavailable()
                              ? 'Time off removes these hours from the selected date only. Conflicting available hours need your approval.'
                              : 'Existing hours are kept, including inherited weekly hours. Matching available ranges merge automatically.'}
                          </p>
                          <Show when={copyIssue()}>
                            {(error) => (
                              <p role="alert" class="mt-2 text-xs text-failure">
                                {error().message}
                              </p>
                            )}
                          </Show>
                          <Show when={copyIssue()?.overlaps?.length}>
                            <Button
                              class="mt-3 h-auto min-h-7 w-full whitespace-normal py-1.5"
                              variant="cta"
                              size="sm"
                              tooltip="Replace conflicting hours and copy the range"
                              onClick={() => copy(true)}
                            >
                              {unavailable()
                                ? 'Mark overlapping hours unavailable and copy'
                                : 'Make overlapping hours available and copy'}
                            </Button>
                          </Show>
                          <Button
                            class="mt-3 w-full"
                            variant="strong"
                            size="sm"
                            disabled={
                              props.change.target.kind === 'weekly'
                                ? !days().length
                                : !date() ||
                                  (props.change.target.kind === 'date' &&
                                    date() === props.change.target.date)
                            }
                            tooltip="Copy hours or leave conflicting hours unchanged"
                            onClick={() =>
                              copyIssue()?.overlaps?.length
                                ? props.onClose()
                                : copy(false)
                            }
                          >
                            {copyIssue()?.overlaps?.length
                              ? 'Keep existing hours'
                              : 'Copy hours'}
                          </Button>
                        </div>
                      </Show>
                    </>
                  }
                >
                  {(draft) => (
                    <AvailabilityRangeEditor
                      change={draft()}
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
                    />
                  )}
                </Show>
              </div>
            </div>
          </Popover.Content>
        </Layer>
      </Popover.Portal>
    </Popover>
  );
}
