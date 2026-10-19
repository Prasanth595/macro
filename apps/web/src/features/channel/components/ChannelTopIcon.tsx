import { PersonaAvatar } from '@app/features/agent-dms/components/persona-avatar';
import { ChannelAvatar } from '@channel/channel-avatar';
import { UserIcon } from '@core/component/UserIcon';
import { useChannel } from '@core/context/channels';
import { useUserId } from '@core/context/user';
import HashIcon from '@phosphor/hash-straight.svg';
import type { ChannelParticipant } from '@queries/channel/types';
import { ChannelType } from '@service-storage/generated/schemas/channelType';
import { Show } from 'solid-js';

export type ChannelTopIconProps = {
  channelId: string;
  channelType: ChannelType | undefined;
  participants: ChannelParticipant[];
  size?: 'sm' | 'lg';
};

/** Channel avatar, or the other participant's avatar for a direct message. */
export function ChannelTopIcon(props: ChannelTopIconProps) {
  const channel = useChannel(props.channelId);
  const userId = useUserId();
  const recipient = () => {
    return props.participants.find((p) => p && p.user_id !== userId());
  };

  return (
    <Show
      when={channel()?.agent_dm}
      fallback={
        <Show
          when={props.channelType === ChannelType.direct_message && recipient()}
          fallback={
            <ChannelAvatar
              channelId={props.channelId}
              class={
                props.size === 'lg'
                  ? 'size-14 rounded-full bg-control [&_img]:rounded-full'
                  : 'size-4 [&_img]:rounded-full'
              }
              fallback={
                props.size === 'lg' ? (
                  <HashIcon class="m-auto size-7 text-ink-muted" />
                ) : undefined
              }
            />
          }
        >
          {(recipient) => (
            <UserIcon
              id={recipient().user_id}
              isDeleted={false}
              size={props.size ?? 'sm'}
              class={props.size === 'lg' ? 'size-14' : undefined}
            />
          )}
        </Show>
      }
    >
      {(persona) => (
        <PersonaAvatar
          botId={persona().bot_id}
          name={persona().name}
          avatarUrl={persona().avatar_url}
          size={props.size ?? 'sm'}
          class={props.size === 'lg' ? 'size-14' : undefined}
        />
      )}
    </Show>
  );
}
