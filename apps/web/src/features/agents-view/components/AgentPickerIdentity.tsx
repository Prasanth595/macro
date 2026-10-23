import Check from '@phosphor/check.svg';
import { Show } from 'solid-js';
import type { RosterAgent } from '../core/roster';
import { AgentIcon } from './AgentGlyph';

/** Consistent identity and availability details in desktop and mobile pickers. */
export function AgentPickerIdentity(props: {
  agent: RosterAgent;
  selected: boolean;
  name?: string;
}) {
  return (
    <>
      <AgentIcon agent={props.agent} class="size-4 shrink-0" />
      <span class="min-w-0 flex-1 text-left">
        <span
          class="block truncate text-sm leading-5"
          title={`${props.name ?? props.agent.name} · ${props.agent.runtime.label}`}
        >
          {props.name ?? props.agent.name}
        </span>
        <Show when={props.agent.unavailableReason}>
          <span class="block truncate text-xs leading-4 text-ink-muted">
            {props.agent.connectLabel ?? props.agent.unavailableReason}
          </span>
        </Show>
      </span>
      <Show when={props.selected}>
        <Check class="size-4 shrink-0 text-accent" />
      </Show>
    </>
  );
}
