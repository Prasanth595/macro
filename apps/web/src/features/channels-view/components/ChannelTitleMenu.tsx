import { toSingleEntityActionListState } from '@app/features/next-soup/actions';
import { SoupEntityActionsDropdown } from '@app/features/soup/SoupEntityActionsDropdown';
import { ChannelDetailTitle } from '@channel/Channel/ChannelDetail';
import type { ChannelEntity } from '@entity';
import DotsThreeIcon from '@phosphor/dots-three.svg';
import { CHANNEL_ACTION_VIEW_CONTEXT } from './rail/ChannelRailItems';

/**
 * The conversation's title followed by its entity actions. Identity changes
 * open the shared draft editor instead of the rail's immediate rename/picture
 * actions; the remaining actions match the conversation's rail row.
 */
export function ChannelTitleMenu(props: { channel: ChannelEntity }) {
  const list = toSingleEntityActionListState(() => props.channel);

  return (
    <div class="flex min-w-0 shrink items-center gap-1">
      <ChannelDetailTitle
        channelId={props.channel.id}
        fallbackName={props.channel.name}
      >
        {(editIdentity) => (
          <SoupEntityActionsDropdown
            entity={props.channel}
            list={list}
            viewContext={CHANNEL_ACTION_VIEW_CONTEXT}
            triggerProps={{ size: 'icon-sm', label: 'Channel actions' }}
            onEditChannel={editIdentity}
          >
            <DotsThreeIcon />
          </SoupEntityActionsDropdown>
        )}
      </ChannelDetailTitle>
    </div>
  );
}
