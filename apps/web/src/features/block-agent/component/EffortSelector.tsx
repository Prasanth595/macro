import { MobileDrawer } from '@components/app/mobile/MobileDrawer';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { Popover } from '@kobalte/core/popover';
import CheckIcon from '@phosphor/check.svg';
import { Button, Tooltip } from '@ui';
import { createSignal, For, Show } from 'solid-js';
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
  const changeOpen = (value: boolean) => {
    setOpen(value);
    props.onOpenChange?.(value);
  };
  const choices = () => props.config?.options ?? [];
  const value = () => props.value ?? props.config?.currentValue;
  const label = () =>
    choices().find((choice) => choice.value === value())?.name ?? 'Default';
  const angle = () => {
    const index = choices().findIndex((choice) => choice.value === value());
    return -70 + (Math.max(0, index) / Math.max(1, choices().length - 1)) * 140;
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
    <div>
      <div class="mb-2 flex justify-between px-1 text-xs text-ink-muted">
        <span>Lower effort</span>
        <span>Higher effort</span>
      </div>
      <div
        role="group"
        aria-label="Reasoning effort"
        class="flex gap-1 overflow-x-auto"
      >
        <For each={choices()}>
          {(choice) => (
            <Button
              variant="ghost"
              class="h-auto min-h-12 min-w-12 flex-1 flex-col justify-center gap-1 rounded-lg px-2 py-2 text-xs"
              aria-pressed={choice.value === value()}
              disabled={props.disabled}
              onClick={() => {
                if (!props.config) return;
                props.onChange({
                  configId: props.config.id,
                  value: choice.value,
                  name: choice.name,
                });
                changeOpen(false);
              }}
            >
              {choice.name}
              <CheckIcon
                class="size-3"
                classList={{ invisible: choice.value !== value() }}
              />
            </Button>
          )}
        </For>
      </div>
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
                <div class="px-2 pb-3">{options()}</div>
              </MobileDrawer.ScrollBody>
            </MobileDrawer.Content>
          </MobileDrawer.Portal>
        </MobileDrawer>
      </Show>
    </Show>
  );
}
