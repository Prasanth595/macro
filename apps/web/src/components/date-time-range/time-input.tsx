import { ScopedPortal } from '@core/component/ScopedPortal';
import type { CollectionNode } from '@kobalte/core';
import { Listbox } from '@kobalte/core/listbox';
import { Popover } from '@kobalte/core/popover';
import CaretDownIcon from '@icon/system/regular/caret-down.svg';
import CheckIcon from '@icon/system/regular/check.svg';
import { Layer } from '@ui/components/Layer';
import { cn } from '@ui/utils/classname';
import { createMemo, createSignal, Show } from 'solid-js';
import {
  DAY_TIME_OPTIONS,
  resolveTimeOption,
  selectedTimeOptionId,
  type TimeOption,
} from './time-options';

export const dateLabelFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function TimeOptionItem(props: CollectionNode<TimeOption>) {
  return (
    <Listbox.Item
      item={props}
      class="group flex cursor-default items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-ink outline-none hover:bg-hover data-selected:bg-active data-highlighted:bg-hover"
    >
      <Listbox.ItemLabel>{props.rawValue.label}</Listbox.ItemLabel>
      <div class="flex shrink-0 items-center gap-2">
        <Show when={props.rawValue.detail}>
          {(detail) => (
            <span class="text-xs text-ink-extra-muted">{detail()}</span>
          )}
        </Show>
        <Listbox.ItemIndicator class="text-accent">
          <CheckIcon class="size-3.5" />
        </Listbox.ItemIndicator>
      </div>
    </Listbox.Item>
  );
}

interface TimeInputProps {
  id: string;
  label: string;
  value: string;
  /** Selectable times; defaults to every quarter-hour in a day. */
  options?: TimeOption[];
  /** Highlighted option; defaults to `value` on the anchor day. */
  selectedId?: string;
  onChange: (option: TimeOption) => void;
  /** Called when the native control is cleared; omitted where empty is invalid UI. */
  onClear?: () => void;
  onFocus?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Native time precision in seconds; quarter-hour slots by default. */
  step?: number;
  hideLabel?: boolean;
  class?: string;
}

export function TimeInput(props: TimeInputProps) {
  const [open, setOpen] = createSignal(false);
  let control: HTMLDivElement | undefined;
  let listbox: HTMLElement | undefined;

  const options = createMemo(() => props.options ?? DAY_TIME_OPTIONS);
  const selectedTime = createMemo(() => [
    props.selectedId ?? selectedTimeOptionId(props.value),
  ]);
  const scrollToSelectedTime = () => {
    requestAnimationFrame(() => {
      listbox
        ?.querySelector<HTMLElement>('[data-selected]')
        ?.scrollIntoView({ block: 'center' });
    });
  };
  const setDropdownOpen = (nextOpen: boolean) => {
    if (props.disabled) return;
    setOpen(nextOpen);
    if (nextOpen) scrollToSelectedTime();
  };
  const selectTime = (values: Set<string>) => {
    const id = values.values().next().value;
    if (typeof id !== 'string') return;
    const option = options().find((candidate) => candidate.id === id);
    if (option && id !== selectedTime()[0]) props.onChange(option);
    setOpen(false);
  };

  return (
    <Popover
      anchorRef={() => control}
      open={open() && !props.disabled}
      onOpenChange={setDropdownOpen}
      placement="bottom-start"
      gutter={4}
      flip
      slide
    >
      {!props.hideLabel && (
        <label for={props.id} class="block text-xxs font-medium text-ink-muted">
          {props.label}
        </label>
      )}
      <div
        ref={control}
        class={cn('relative', !props.hideLabel && 'mt-1', props.class)}
      >
        <input
          id={props.id}
          type="time"
          step={props.step ?? 900}
          value={props.value}
          disabled={props.disabled}
          aria-invalid={props.invalid || undefined}
          aria-expanded={open()}
          aria-haspopup="listbox"
          class="w-full appearance-none rounded-md border border-edge-muted bg-control py-1.5 pr-7 pl-2 text-xs text-ink outline-none focus:border-accent aria-invalid:border-failure aria-invalid:ring-2 aria-invalid:ring-failure/20 disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:hidden"
          onFocus={() => {
            props.onFocus?.();
            setDropdownOpen(true);
          }}
          onClick={() => setDropdownOpen(true)}
          onInput={(event) => {
            const value = event.currentTarget.value;
            if (!value) {
              props.onClear?.();
              setOpen(false);
            } else if (value !== props.value) {
              props.onChange(resolveTimeOption(options(), value));
            }
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || !open()) return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }}
        />
        <CaretDownIcon
          aria-hidden="true"
          class="pointer-events-none absolute top-1/2 right-2 size-3 -translate-y-1/2 text-ink-extra-muted"
        />
      </div>

      <ScopedPortal scope="local">
        <Layer depth={4}>
          <Popover.Content
            class="menu-surface z-action-menu max-h-64 min-w-[var(--kb-popper-anchor-width)] overflow-y-auto p-1.5 menu-open-animation"
            style={{
              'z-index': 'calc(var(--z-index-action-menu) + 1)',
            }}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              const target = event.detail.originalEvent.target;
              if (target instanceof Node && control?.contains(target)) {
                event.preventDefault();
              }
            }}
            on:keydown={(event: KeyboardEvent) => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }}
          >
            <Popover.Title class="sr-only">
              Choose {props.label.toLowerCase()}
            </Popover.Title>
            <Listbox<TimeOption>
              ref={(element) => {
                listbox = element;
              }}
              options={options()}
              optionValue="id"
              optionTextValue="label"
              value={selectedTime()}
              onChange={selectTime}
              selectionMode="single"
              disallowEmptySelection
              shouldFocusWrap
              renderItem={(item) => <TimeOptionItem {...item} />}
            />
          </Popover.Content>
        </Layer>
      </ScopedPortal>
    </Popover>
  );
}
