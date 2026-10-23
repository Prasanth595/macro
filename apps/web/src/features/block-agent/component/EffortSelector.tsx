import { MobileDrawer } from '@components/app/mobile/MobileDrawer';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import CaretDown from '@phosphor/caret-down.svg';
import Check from '@phosphor/check.svg';
import Gauge from '@phosphor/gauge.svg';
import { Button, Dropdown, Tooltip } from '@ui';
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
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const [open, setOpen] = createSignal(false);
  const changeOpen = (value: boolean) => {
    setOpen(value);
    props.onOpenChange?.(value);
  };
  const choices = () => props.config?.options ?? [];
  const value = () => props.value ?? props.config?.currentValue;
  const index = () =>
    Math.max(
      0,
      choices().findIndex((choice) => choice.value === value())
    );
  const label = () => choices()[index()]?.name ?? 'Default';
  const choose = (choice: SelectSessionConfigOption['options'][number]) => {
    if (!props.config || props.disabled) return;
    props.onChange({
      configId: props.config.id,
      value: choice.value,
      name: choice.name,
    });
    changeOpen(false);
  };
  const optionLabel = (
    choice: SelectSessionConfigOption['options'][number]
  ) => (
    <>
      <span class="flex-1">{choice.name}</span>
      <Show when={choice.value === value()}>
        <Check class="size-4" />
      </Show>
    </>
  );
  return (
    <Show when={choices().length > 1}>
      <Show
        when={isTouchDevice()}
        fallback={
          <Dropdown open={open()} onOpenChange={changeOpen} placement="bottom">
            <Tooltip label={`Effort: ${label()}`} disabled={open()}>
              <Dropdown.Trigger
                variant="ghost"
                size="sm"
                class="h-[33.75px] gap-1.5 rounded-full px-2 text-ink-muted"
                disabled={props.disabled}
                aria-label={`Effort: ${label()}`}
              >
                <Gauge class="size-4" />
                <span>{label()}</span>
                <CaretDown class="size-3.5" />
              </Dropdown.Trigger>
            </Tooltip>
            <Dropdown.Content
              class="w-44 rounded-2xl"
              aria-label="Reasoning effort"
              onCloseAutoFocus={props.onCloseAutoFocus}
            >
              <Dropdown.Group>
                <For each={choices()}>
                  {(choice) => (
                    <Dropdown.Item
                      closeOnSelect
                      title={choice.description ?? undefined}
                      disabled={props.disabled}
                      onSelect={() => choose(choice)}
                    >
                      {optionLabel(choice)}
                    </Dropdown.Item>
                  )}
                </For>
              </Dropdown.Group>
            </Dropdown.Content>
          </Dropdown>
        }
      >
        <MobileDrawer
          side="bottom"
          open={open()}
          onOpenChange={changeOpen}
          restoreFocus={!!props.onCloseAutoFocus}
          onFinalFocus={props.onCloseAutoFocus}
        >
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
            <Gauge class="size-[18px]" />
          </MobileDrawer.Trigger>
          <MobileDrawer.Portal>
            <MobileDrawer.Overlay />
            <MobileDrawer.Content aria-label="Reasoning effort">
              <MobileDrawer.Handle />
              <MobileDrawer.Title class="px-4 pb-3 font-medium">
                Reasoning effort
              </MobileDrawer.Title>
              <MobileDrawer.ScrollBody>
                <MobileDrawer.Section
                  role="group"
                  aria-label="Reasoning effort"
                >
                  <For each={choices()}>
                    {(choice) => (
                      <MobileDrawer.Item
                        aria-pressed={choice.value === value()}
                        disabled={props.disabled}
                        onClick={() => choose(choice)}
                      >
                        {optionLabel(choice)}
                      </MobileDrawer.Item>
                    )}
                  </For>
                </MobileDrawer.Section>
              </MobileDrawer.ScrollBody>
            </MobileDrawer.Content>
          </MobileDrawer.Portal>
        </MobileDrawer>
      </Show>
    </Show>
  );
}
