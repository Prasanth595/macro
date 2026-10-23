/**
 * The composer's choice of what AI chat runs on, for sessions whose owner has
 * their own or a team's provider API key: a key icon in the composer's
 * controls, tinted while a key is in use, and a small "Using …" label the
 * composer shows above its top-right corner. With one key on offer the icon
 * toggles that key; with both, it opens a menu of all three.
 */

import { MobileDrawer } from '@components/app/mobile/MobileDrawer';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import Check from '@phosphor/check.svg';
import KeyIcon from '@phosphor/key.svg';
import { Button, cn, Dropdown } from '@ui';
import { createSignal, For, type JSX, Show } from 'solid-js';
import { match } from 'ts-pattern';
import {
  fundingName,
  isKeyFunding,
  type KeyFunding,
  type SelectSessionConfigOption,
  type SessionFunding,
} from '../state/session-config';

export const PERSONAL_USAGE_LABEL = `Using ${fundingName('personal_api_key')}`;
export const TEAM_USAGE_LABEL = `Using ${fundingName('team_api_key')}`;

export function usageLabel(funding: KeyFunding): string {
  return `Using ${fundingName(funding)}`;
}

function turnOnLabel(funding: KeyFunding): string {
  return match(funding)
    .with('personal_api_key', () => 'Use your own API key for AI chat')
    .with('team_api_key', () => "Use your team's API key for AI chat")
    .exhaustive();
}

export function UsageSourceControl(props: {
  option: SelectSessionConfigOption;
  disabled?: boolean;
  onChoose: (funding: SessionFunding) => void;
}) {
  const [open, setOpen] = createSignal(false);
  const current = () =>
    isKeyFunding(props.option.currentValue)
      ? props.option.currentValue
      : undefined;
  const keys = () =>
    props.option.options
      .map((choice) => choice.value)
      .filter((value): value is KeyFunding => isKeyFunding(value));
  const label = () => {
    const on = current();
    if (on) return `${usageLabel(on)} · change usage`;
    const only = keys().length === 1 ? keys()[0] : undefined;
    return only ? turnOnLabel(only) : 'Choose what AI chat runs on';
  };
  const contents = (): JSX.Element => <KeyIcon class="size-4" />;
  const buttonProps = () => ({
    variant: 'ghost' as const,
    size: 'icon-composer' as const,
    label: label(),
    'aria-label': label(),
    disabled: props.disabled,
    class: cn('shrink-0', current() ? 'text-accent' : 'text-ink-muted'),
  });

  return (
    <Show
      when={keys().length > 1}
      fallback={
        <Button
          {...buttonProps()}
          aria-pressed={current() !== undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => props.onChoose(current() ? 'macro' : keys()[0])}
        >
          {contents()}
        </Button>
      }
    >
      <Show
        when={isTouchDevice()}
        fallback={
          <Dropdown placement="top-start">
            <Dropdown.Trigger
              {...buttonProps()}
              onMouseDown={(event: MouseEvent) => event.preventDefault()}
            >
              {contents()}
            </Dropdown.Trigger>
            <Dropdown.Content class="w-56" aria-label="AI chat usage">
              <For each={props.option.options}>
                {(choice) => (
                  <Dropdown.Item
                    closeOnSelect
                    title={choice.description ?? undefined}
                    onSelect={() => {
                      if (
                        choice.value === 'macro' ||
                        isKeyFunding(choice.value)
                      )
                        props.onChoose(choice.value);
                    }}
                  >
                    <span class="flex-1">{choice.name}</span>
                    <Show when={choice.value === props.option.currentValue}>
                      <Check class="size-3.5 text-accent" />
                    </Show>
                  </Dropdown.Item>
                )}
              </For>
            </Dropdown.Content>
          </Dropdown>
        }
      >
        <MobileDrawer side="bottom" open={open()} onOpenChange={setOpen}>
          <MobileDrawer.Trigger
            as={Button}
            {...buttonProps()}
            onPointerDown={(event: PointerEvent) => event.preventDefault()}
            onMouseDown={(event: MouseEvent) => event.preventDefault()}
          >
            {contents()}
          </MobileDrawer.Trigger>
          <MobileDrawer.Portal>
            <MobileDrawer.Overlay />
            <MobileDrawer.Content aria-label="AI chat usage">
              <MobileDrawer.Handle />
              <MobileDrawer.Title class="px-4 pb-3 font-medium">
                AI chat usage
              </MobileDrawer.Title>
              <MobileDrawer.ScrollBody>
                <MobileDrawer.Section role="group" aria-label="AI chat usage">
                  <For each={props.option.options}>
                    {(choice) => (
                      <MobileDrawer.Item
                        aria-pressed={
                          choice.value === props.option.currentValue
                        }
                        disabled={props.disabled}
                        onClick={() => {
                          setOpen(false);
                          if (
                            choice.value === 'macro' ||
                            isKeyFunding(choice.value)
                          )
                            props.onChoose(choice.value);
                        }}
                      >
                        <span class="flex-1">{choice.name}</span>
                        <Show when={choice.value === props.option.currentValue}>
                          <Check class="size-4" />
                        </Show>
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

/** "Using your API key" / "Using team API usage", shown just above the
 * composer's top-right corner while a session runs on a key. */
export function UsageSourceLabel(props: { funding: KeyFunding }) {
  return (
    <div class="mb-1 flex justify-end px-1">
      <span class="inline-flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 text-xs text-accent">
        <KeyIcon class="size-3" aria-hidden="true" />
        {usageLabel(props.funding)}
      </span>
    </div>
  );
}
