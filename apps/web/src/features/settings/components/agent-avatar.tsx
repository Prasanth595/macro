import { MACRO_AGENT_BOT_ID } from '@core/constant/macroAgent';
import MacroLogo from '@icon/macro-logo.svg';
import AgentIcon from '@icon/system/regular/sparkle.svg';
import { Avatar } from '@ui';
import { Show } from 'solid-js';
import { AgentFace } from './agent-face';

/**
 * An agent's uploaded picture, the Macro mark for the built-in agent, or the
 * agent's Line face derived from its @tag.
 */
export function AgentAvatar(props: {
  id: string;
  name: string;
  tag: string;
  avatarUrl?: string;
}) {
  return (
    <Show
      when={props.avatarUrl || props.id === MACRO_AGENT_BOT_ID}
      fallback={
        <AgentFace seed={props.tag || props.name} class="size-10 shrink-0" />
      }
    >
      <Avatar size="lg" class="bg-surface text-accent ring ring-edge-muted">
        <Show
          when={props.avatarUrl}
          fallback={
            <Avatar.Fallback>
              <Show
                when={props.id === MACRO_AGENT_BOT_ID}
                fallback={<AgentIcon class="size-5" />}
              >
                <MacroLogo class="size-5" />
              </Show>
            </Avatar.Fallback>
          }
        >
          {(avatarUrl) => (
            <Avatar.Image src={avatarUrl()} alt={`${props.name} avatar`} />
          )}
        </Show>
      </Avatar>
    </Show>
  );
}
