import { ChannelTopIcon } from '@channel/components/ChannelTopIcon';
import { useChannelName, useChannelType } from '@core/context/channels';
import XIcon from '@phosphor/x.svg';
import { useChannelParticipantsQuery } from '@queries/channel/channel-participants';
import { Button, Tabs } from '@ui';
import { type ParentProps, Show } from 'solid-js';
import { useChannelTab } from './ChannelTabContext';
import { CHANNEL_TABS, isChannelInfoTab } from './channel-tabs';
import { useChannelTabItems } from './use-channel-tab-items';

/** Full-height channel information beside both the conversation and its header. */
export function ChannelInfoPanel(
  props: ParentProps<{ channelId: string; fallbackName?: string }>
) {
  const { infoPanel } = useChannelTab();
  const name = useChannelName(props.channelId, props.fallbackName);
  const channelType = useChannelType(props.channelId);
  const participantsQuery = useChannelParticipantsQuery(() => props.channelId);
  const participants = () =>
    participantsQuery.isSuccess ? (participantsQuery.data ?? []) : [];
  const availableTabs = useChannelTabItems(props.channelId);
  const tabs = () =>
    CHANNEL_TABS.filter(
      (tab) =>
        isChannelInfoTab(tab.value) &&
        availableTabs().some((available) => available.value === tab.value)
    );

  return (
    <Show when={infoPanel}>
      {(panel) => (
        <aside
          id={panel().id}
          aria-label="Channel details"
          hidden={!panel().isOpen()}
          class="w-80 max-w-[45%] min-h-0 min-w-0 shrink-0 flex-col border-l border-edge-muted bg-surface"
          classList={{ flex: panel().isOpen() }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            event.preventDefault();
            event.stopPropagation();
            panel().close();
          }}
        >
          <div class="flex h-12 shrink-0 items-center justify-end px-3">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close channel details"
              onClick={() => panel().close()}
            >
              <XIcon />
            </Button>
          </div>
          <div class="flex shrink-0 flex-col items-center gap-3 px-4 pb-5 pt-2 text-center">
            <ChannelTopIcon
              channelId={props.channelId}
              channelType={channelType()}
              participants={participants()}
              size="lg"
            />
            <div class="w-full min-w-0">
              <h2 class="text-lg font-semibold leading-tight break-words">
                {name() ?? 'New Channel'}
              </h2>
              <Show when={participantsQuery.isSuccess}>
                <p class="mt-1 text-xs text-ink-muted">
                  {participants().length} participants
                </p>
              </Show>
            </div>
          </div>
          <div class="mx-4 shrink-0 overflow-x-auto border-b border-edge-muted pb-2">
            <Tabs
              variant="plain"
              aria-label="Channel information"
              list={tabs()}
              value={panel().activeTab()}
              onChange={(tab) => {
                if (isChannelInfoTab(tab)) panel().setActiveTab(tab);
              }}
            />
          </div>
          <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Show when={panel().isOpen()}>{props.children}</Show>
          </div>
        </aside>
      )}
    </Show>
  );
}
