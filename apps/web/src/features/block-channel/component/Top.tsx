import { toIconTabItems } from '@channel/Channel/channel-tab-icons';
import type { ChannelTabId } from '@channel/Channel/channel-tabs';
import { ChannelIdentityTitle } from '@channel/channel-identity';
import { ChannelTopIcon } from '@channel/components/ChannelTopIcon';
import { CollapsibleHeaderItem } from '@components/app/split-layout/components/CollapsibleItem';
import { HeaderIsland } from '@components/app/split-layout/components/HeaderIsland';
import { SplitHeaderLeft } from '@components/app/split-layout/components/SplitHeader';
import { SplitLabel } from '@components/app/split-layout/components/SplitLabel';
import { useSplitPanelOrThrow } from '@components/app/split-layout/layoutUtils';
import { useBlockId } from '@core/block';
import type { TabItem } from '@core/component/Tabs';
import { TabsInset } from '@core/component/TabsInset';
import { useChannelName } from '@core/context/channels';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import CaretDownIcon from '@phosphor/caret-down.svg';
import type { ChannelParticipant } from '@queries/channel/types';
import type { ChannelType } from '@service-storage/generated/schemas/channelType';
import { Button } from '@ui/components/Button';
import { Show } from 'solid-js';

type TopProps = {
  channelType: ChannelType;
  participants: ChannelParticipant[];
  channelName: string;
  channelId: string;
};

type ChannelTopLeftProps = TopProps & {
  lockRename?: boolean;
  canEditIdentity: boolean;
  onEditIdentity: () => void;
  tabs?: readonly TabItem[];
  activeTab?: ChannelTabId;
  onTabChange?: (value: ChannelTabId) => void;
};

export function ChannelTopLeft(props: ChannelTopLeftProps) {
  const panel = useSplitPanelOrThrow();
  const blockId = useBlockId();
  const channelName = useChannelName(
    blockId,
    props.channelName ?? 'New Channel'
  );

  const iconTabList = () =>
    toIconTabItems(props.tabs ?? [], 'size-4 touch:size-6');

  const hasTabsMenu = () => !!(props.tabs?.length && props.onTabChange);

  return (
    <SplitHeaderLeft>
      <HeaderIsland class="shrink">
        <div class="ph-no-capture z-split-header-content relative flex items-center gap-2 max-w-full h-full shrink min-w-15">
          <ChannelTopIcon
            channelId={props.channelId}
            channelType={props.channelType}
            participants={props.participants}
          />
          <ChannelIdentityTitle
            canEdit={props.canEditIdentity}
            disabled={props.channelType === 'direct_message'}
            onEdit={props.onEditIdentity}
          >
            <span
              class={
                props.canEditIdentity
                  ? 'pointer-events-none touch:[&_svg]:hidden'
                  : undefined
              }
            >
              <SplitLabel
                label={channelName() ?? 'New Channel'}
                lockRename={props.lockRename}
                renameOverrides={{ channelType: props.channelType }}
                maxDisplayLength={48}
              />
            </span>
          </ChannelIdentityTitle>
          <Show
            when={
              isTouchDevice() &&
              props.canEditIdentity &&
              panel.titleFileMenuTrigger()
            }
          >
            <Button
              variant="ghost"
              size="icon-sm"
              label="Channel options"
              onClick={() => panel.titleFileMenuTrigger()?.()}
            >
              <CaretDownIcon class="size-4" />
            </Button>
          </Show>
          <div
            class="shrink-0 flex items-center h-full"
            ref={(ref) => panel.setTitleFileMenuRef(ref)}
          />
        </div>
      </HeaderIsland>
      <Show when={!isTouchDevice() && hasTabsMenu() && props.activeTab}>
        <CollapsibleHeaderItem
          id="channel-tabs"
          priority={1}
          containerClass="ph-no-capture min-w-0 shrink-0 h-full mx-2"
        >
          {(isCollapsed) => (
            <TabsInset
              list={isCollapsed() ? iconTabList() : [...(props.tabs ?? [])]}
              value={props.activeTab}
              onChange={(value) => props.onTabChange?.(value as ChannelTabId)}
            />
          )}
        </CollapsibleHeaderItem>
      </Show>
    </SplitHeaderLeft>
  );
}
