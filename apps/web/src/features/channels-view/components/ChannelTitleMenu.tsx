import { toSingleEntityActionListState } from '@app/features/next-soup/actions';
import { SoupEntityActionsDropdown } from '@app/features/soup/SoupEntityActionsDropdown';
import { ChannelDetailTitle } from '@channel/Channel/ChannelDetail';
import type { ChannelEntity } from '@entity';
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
        identityOpen={editOpen()}
        onIdentityOpenChange={setEditOpen}
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
    </div>
  );
}
