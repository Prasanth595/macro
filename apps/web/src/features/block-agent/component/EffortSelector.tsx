import { MobileDrawer } from '@components/app/mobile/MobileDrawer';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { Popover } from '@kobalte/core/popover';
import { Button, Tooltip } from '@ui';
import { createSignal, Show } from 'solid-js';
import type {
  EffortChoice,
  SelectSessionConfigOption,
} from '../state/session-config';

/** Effort control beside the selected model in the composer. */
export function EffortSelector(props: {
  config?: SelectSessionConfigOption;
  value?: string;
  disabled?: boolean;
  onChange: (choice: EffortChoice) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = createSignal(false);
  const [preview, setPreview] = createSignal<number>();
  const changeOpen = (value: boolean) => {
    setOpen(value);
    setPreview(undefined);
    props.onOpenChange?.(value);
  };
  const choices = () => props.config?.options ?? [];
  const value = () => props.value ?? props.config?.currentValue;
  const index = () =>
    preview() ??
    Math.max(
      0,
      choices().findIndex((choice) => choice.value === value())
    );
  const label = () => choices()[index()]?.name ?? 'Default';
  const angle = () => {
    return -70 + (index() / Math.max(1, choices().length - 1)) * 140;
  };
  const contents = () => (
    <svg viewBox="0 0 24 24" class="size-[22px]" fill="none" aria-hidden="true">
      <path
        d="M4.5 18a9 9 0 1 1 15 0"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        opacity="0.45"
      />
      <g transform={`rotate(${angle()} 12 14)`}>
        <path
          d="M12 14V8"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </g>
      <circle cx="12" cy="14" r="2" fill="currentColor" />
    </svg>
  );
  const options = () => (
    <div class="px-1">
      <div class="mb-1 text-center text-xs text-ink-muted" aria-hidden="true">
        {label()}
      </div>
      <input
        type="range"
        aria-label="Reasoning effort"
        aria-valuetext={label()}
        min={0}
        max={choices().length - 1}
        step={1}
        value={index()}
        disabled={props.disabled}
        class="m-0 h-9 w-full appearance-none rounded-full bg-transparent text-ink outline-none focus-visible:ring-2 focus-visible:ring-edge-focus disabled:opacity-50 [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-ink/20 [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-ink/20 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink"
        onInput={(event) => setPreview(Number(event.currentTarget.value))}
        onChange={(event) => {
          const choice = choices()[Number(event.currentTarget.value)];
          if (!props.disabled && props.config && choice)
            props.onChange({
              configId: props.config.id,
              value: choice.value,
              name: choice.name,
            });
          setPreview(undefined);
        }}
      />
    </div>
  );
  return (
    <Show when={choices().length > 1}>
      <Show
        when={isTouchDevice()}
        fallback={
          <Popover
            open={open()}
            onOpenChange={changeOpen}
            placement="top-start"
            gutter={8}
          >
            <Tooltip label={`Effort: ${label()}`} disabled={open()}>
              <Popover.Trigger
                as={Button}
                variant="ghost"
                size="sm"
                class="size-8 rounded-full p-0"
                disabled={props.disabled}
                aria-label={`Effort: ${label()}`}
              >
                {contents()}
              </Popover.Trigger>
            </Tooltip>
            <Popover.Portal>
              <Popover.Content
                class="menu-surface z-modal w-72 max-w-[calc(100vw-2rem)] p-3"
                aria-label="Reasoning effort"
              >
                {options()}
              </Popover.Content>
            </Popover.Portal>
          </Popover>
        }
      >
        <MobileDrawer side="bottom" open={open()} onOpenChange={changeOpen}>
          <MobileDrawer.Trigger
            as={Button}
            variant="ghost"
            size="sm"
            class="size-[34px] rounded-full p-0"
            disabled={props.disabled}
            aria-label={`Effort: ${label()}`}
            title={`Effort: ${label()}`}
            onPointerDown={(event: PointerEvent) => event.preventDefault()}
            onMouseDown={(event: MouseEvent) => event.preventDefault()}
          >
            {contents()}
          </MobileDrawer.Trigger>
          <MobileDrawer.Portal>
            <MobileDrawer.Overlay />
            <MobileDrawer.Content aria-label="Reasoning effort">
              <MobileDrawer.Handle />
              <MobileDrawer.Title class="px-4 pb-3 font-medium">
                Reasoning effort
              </MobileDrawer.Title>
              <MobileDrawer.ScrollBody>
                <div class="px-5 pb-4">{options()}</div>
              </MobileDrawer.ScrollBody>
            </MobileDrawer.Content>
          </MobileDrawer.Portal>
        </MobileDrawer>
      </Show>
    </Show>
  );
}
