import { MobileDrawer } from '@components/app/mobile/MobileDrawer';
import type { ModelSpeed } from '@core/component/AI/constant/speed';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import CaretDown from '@phosphor/caret-down.svg';
import Check from '@phosphor/check.svg';
import Gauge from '@phosphor/gauge.svg';
import { Button, cn, Dropdown, Tooltip } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import type {
  EffortChoice,
  SelectSessionConfigOption,
} from '../state/session-config';

/** One menu for the model's reasoning effort and optional accelerated speed. */
export function EffortSelector(props: {
  config?: SelectSessionConfigOption;
  value?: string;
  disabled?: boolean;
  speed?: {
    tier: Exclude<ModelSpeed, 'standard'>;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
  };
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
  const hasEffort = () => choices().length > 1;
  const speedName = () =>
    props.speed?.tier === 'ultrafast' ? 'Ultrafast' : 'Fast';
  const speedLabel = () => (props.speed?.enabled ? speedName() : 'Standard');
  const title = () =>
    hasEffort()
      ? props.speed
        ? 'Effort and speed'
        : 'Reasoning effort'
      : 'Speed';
  const triggerLabel = () =>
    hasEffort()
      ? `${label()}${props.speed?.enabled ? ` · ${speedName()}` : ''}`
      : speedLabel();
  const description = () =>
    [
      hasEffort() && `Effort: ${label()}`,
      props.speed && `Speed: ${speedLabel()}`,
    ]
      .filter(Boolean)
      .join(' · ');
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
  const chooseSpeed = (enabled: boolean) => {
    if (props.disabled || !props.speed) return;
    props.speed.onChange(enabled);
    changeOpen(false);
  };
  const speedOptionLabel = (enabled: boolean) => (
    <>
      <span class="flex-1">{enabled ? speedName() : 'Standard'}</span>
      <Show when={enabled}>
        <span class="text-xs text-ink-muted">
          {props.speed?.tier === 'ultrafast' ? '6×' : '2×'} AI usage
        </span>
      </Show>
      <Show when={props.speed?.enabled === enabled}>
        <Check class="size-4" />
      </Show>
    </>
  );
  return (
    <Show when={hasEffort() || props.speed}>
      <Show
        when={isTouchDevice()}
        fallback={
          <Dropdown open={open()} onOpenChange={changeOpen} placement="bottom">
            <Tooltip label={description()} disabled={open()}>
              <Dropdown.Trigger
                variant="ghost"
                size="sm"
                class="h-[33.75px] gap-1.5 rounded-full px-2 text-ink-muted"
                disabled={props.disabled}
                aria-label={description()}
              >
                <Gauge class="size-4" />
                <span>{triggerLabel()}</span>
                <CaretDown class="size-3.5" />
              </Dropdown.Trigger>
            </Tooltip>
            <Dropdown.Content
              class={cn(
                'max-h-[min(28rem,var(--kb-popper-content-available-height))] overflow-y-auto rounded-2xl',
                props.speed ? 'w-56' : 'w-44'
              )}
              aria-label={title()}
              onCloseAutoFocus={props.onCloseAutoFocus}
            >
              <Show when={hasEffort()}>
                <Dropdown.Group>
                  <Show when={props.speed}>
                    <Dropdown.GroupLabel>Reasoning effort</Dropdown.GroupLabel>
                  </Show>
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
              </Show>
              <Show when={props.speed}>
                <Show when={hasEffort()}>
                  <Dropdown.Separator />
                </Show>
                <Dropdown.Group>
                  <Dropdown.GroupLabel>Speed</Dropdown.GroupLabel>
                  <For each={[false, true]}>
                    {(enabled) => (
                      <Dropdown.Item
                        closeOnSelect
                        disabled={props.disabled}
                        onSelect={() => chooseSpeed(enabled)}
                      >
                        {speedOptionLabel(enabled)}
                      </Dropdown.Item>
                    )}
                  </For>
                </Dropdown.Group>
              </Show>
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
            aria-label={description()}
            title={description()}
            onPointerDown={(event: PointerEvent) => event.preventDefault()}
            onMouseDown={(event: MouseEvent) => event.preventDefault()}
          >
            <Gauge class="size-[18px]" />
          </MobileDrawer.Trigger>
          <MobileDrawer.Portal>
            <MobileDrawer.Overlay />
            <MobileDrawer.Content aria-label={title()}>
              <MobileDrawer.Handle />
              <MobileDrawer.Title class="px-4 pb-3 font-medium">
                {title()}
              </MobileDrawer.Title>
              <MobileDrawer.ScrollBody>
                <Show when={hasEffort()}>
                  <Show when={props.speed}>
                    <MobileDrawer.Label>Reasoning effort</MobileDrawer.Label>
                  </Show>
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
                </Show>
                <Show when={props.speed}>
                  <MobileDrawer.Label>Speed</MobileDrawer.Label>
                  <MobileDrawer.Section role="group" aria-label="Speed">
                    <For each={[false, true]}>
                      {(enabled) => (
                        <MobileDrawer.Item
                          aria-pressed={props.speed?.enabled === enabled}
                          disabled={props.disabled}
                          onClick={() => chooseSpeed(enabled)}
                        >
                          {speedOptionLabel(enabled)}
                        </MobileDrawer.Item>
                      )}
                    </For>
                  </MobileDrawer.Section>
                </Show>
              </MobileDrawer.ScrollBody>
            </MobileDrawer.Content>
          </MobileDrawer.Portal>
        </MobileDrawer>
      </Show>
    </Show>
  );
}
