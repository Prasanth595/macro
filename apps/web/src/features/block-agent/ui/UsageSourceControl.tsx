/**
 * The composer's choice of what AI chat runs on, for sessions whose owner has
 * their own or a team's provider API key. On a key, it reads as a small
 * "Using …" indicator; on Macro usage, it is a key icon. With one key on
 * offer it toggles that key; with both, it opens a menu of all three.
 */

import Check from '@phosphor/check.svg';
import KeyIcon from '@phosphor/key.svg';
import { Button, cn, Dropdown } from '@ui';
import { For, type JSX, Show } from 'solid-js';
import { match } from 'ts-pattern';
import {
  isKeyFunding,
  type KeyFunding,
  type SelectSessionConfigOption,
  type SessionFunding,
} from '../state/session-config';

export const PERSONAL_USAGE_LABEL = 'Using your API key';
export const TEAM_USAGE_LABEL = 'Using team API usage';

export function usageLabel(funding: KeyFunding): string {
  return match(funding)
    .with('personal_api_key', () => PERSONAL_USAGE_LABEL)
    .with('team_api_key', () => TEAM_USAGE_LABEL)
    .exhaustive();
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
  const contents = (): JSX.Element => (
    <>
      <KeyIcon class={current() ? 'size-3' : 'size-4'} />
      <Show when={current()}>{(on) => <span>{usageLabel(on())}</span>}</Show>
    </>
  );
  const buttonProps = () => ({
    variant: 'ghost' as const,
    size: current() ? ('xs' as const) : ('icon-composer' as const),
    label: label(),
    'aria-label': label(),
    disabled: props.disabled,
    class: cn(
      'shrink-0',
      current() ? 'text-accent bg-accent/10' : 'text-ink-muted'
    ),
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
                  if (choice.value === 'macro' || isKeyFunding(choice.value))
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
    </Show>
  );
}
