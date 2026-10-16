import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { Popover } from '@kobalte/core/popover';
import CaretDownIcon from '@phosphor/caret-down.svg';
import CheckIcon from '@phosphor/check.svg';
import { Button } from '@ui';
import { createSignal, createUniqueId, For, Show } from 'solid-js';
import type {
  EffortChoice,
  SelectSessionConfigOption,
} from '../state/session-config';

/** Named effort choices for the selected model, within its model menu. */
export function EffortSelector(props: {
  config?: SelectSessionConfigOption;
  value?: string;
  disabled?: boolean;
  onChange: (choice: EffortChoice) => void;
}) {
  const [open, setOpen] = createSignal(false);
  const id = createUniqueId();
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
      id={id}
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
              setOpen(false);
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
      <div
        data-effort-selector
        class="px-1.5 pb-1"
        onKeyDown={(event) => {
          if (event.key !== 'Escape') event.stopPropagation();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <Show
          when={isTouchDevice()}
          fallback={
            <Popover
              open={open()}
              onOpenChange={setOpen}
              placement="bottom-start"
              gutter={4}
            >
              <Popover.Trigger
                as={Button}
                variant="ghost"
                class="w-full justify-start gap-2 rounded-lg px-3 text-xs"
                disabled={props.disabled}
                aria-label={`Effort: ${label()}`}
              >
                {contents()}
              </Popover.Trigger>
              {/* Keep focus inside the parent model menu’s DOM boundary. */}
              <Popover.Content
                class="menu-surface z-modal min-w-40 p-1"
                aria-label="Reasoning effort"
              >
                {options()}
              </Popover.Content>
            </Popover>
          }
        >
          <Button
            variant="ghost"
            class="w-full justify-start gap-2 rounded-lg px-3 text-sm min-h-11"
            disabled={props.disabled}
            aria-label={`Effort: ${label()}`}
            aria-expanded={open()}
            aria-controls={id}
            onClick={() => setOpen(!open())}
          >
            {contents()}
          </Button>
          <Show when={open()}>{options()}</Show>
        </Show>
      </div>
    </Show>
  );
}
