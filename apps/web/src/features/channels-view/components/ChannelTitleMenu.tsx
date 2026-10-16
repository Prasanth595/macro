import { toSingleEntityActionListState } from '@app/features/next-soup/actions';
import { SoupEntityActionsDropdown } from '@app/features/soup/SoupEntityActionsDropdown';
import { ChannelDetailTitle } from '@channel/Channel/ChannelDetail';
import { ChannelIdentityDialog } from '@channel/channel-identity';
import { type ChannelEntity, canEditChannelIdentity } from '@entity';
import DotsThreeIcon from '@phosphor/dots-three.svg';
import { createSignal } from 'solid-js';
import { CHANNEL_ACTION_VIEW_CONTEXT } from './rail/ChannelRailItems';

/**
 * The conversation's title followed by its entity actions. Identity changes
 * open the shared draft editor instead of the rail's immediate rename/picture
 * actions; the remaining actions match the conversation's rail row.
 */
export function ChannelTitleMenu(props: { channel: ChannelEntity }) {
  const list = toSingleEntityActionListState(() => props.channel);
  const [editOpen, setEditOpen] = createSignal(false);

  return (
    <div class="flex min-w-0 shrink items-center gap-1">
      <ChannelDetailTitle
        channelId={props.channel.id}
        fallbackName={props.channel.name}
      />
      <SoupEntityActionsDropdown
        entity={props.channel}
        list={list}
        viewContext={CHANNEL_ACTION_VIEW_CONTEXT}
        triggerProps={{ size: 'icon-sm', label: 'Channel actions' }}
        onEditChannel={() => setEditOpen(true)}
      >
        <DotsThreeIcon />
      </SoupEntityActionsDropdown>
      <ChannelIdentityDialog
        channelId={props.channel.id}
        name={props.channel.name}
        canEdit={canEditChannelIdentity(props.channel)}
        open={editOpen()}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}
