import { MobileDrawer } from '@components/app/mobile/MobileDrawer';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { Popover } from '@kobalte/core/popover';
import CaretDownIcon from '@phosphor/caret-down.svg';
import CheckIcon from '@phosphor/check.svg';
import { Button } from '@ui';
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
  const contents = () => (
    <>
      <span class="text-ink-muted">Effort</span>
      <span aria-hidden="true" class="text-ink-extra-muted">
        ·
      </span>
      <span>{label()}</span>
      <CaretDownIcon
        class="ml-auto size-3 transition-transform"
        classList={{ 'rotate-180': open() }}
      />
    </>
  );
  const options = () => (
    <div
      role="group"
      aria-label="Reasoning effort"
      class="flex flex-col gap-0.5"
    >
      <For each={choices()}>
        {(choice) => (
          <Button
            variant="ghost"
            class="w-full justify-between rounded-lg px-3 touch:min-h-11"
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
            <Show when={choice.value === value()}>
              <CheckIcon class="size-4" />
            </Show>
          </Button>
        )}
      </For>
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
            <Popover.Trigger
              as={Button}
              variant="ghost"
              size="sm"
              class="gap-1.5 rounded-full px-2 text-xs"
              disabled={props.disabled}
              aria-label={`Effort: ${label()}`}
            >
              {contents()}
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                class="menu-surface z-modal min-w-40 p-1"
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
            class="h-[34px] gap-1.5 rounded-full px-2 text-xs"
            disabled={props.disabled}
            aria-label={`Effort: ${label()}`}
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
