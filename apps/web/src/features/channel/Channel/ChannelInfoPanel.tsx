import XIcon from '@phosphor/x.svg';
import { Button, Tabs } from '@ui';
import { type ParentProps, Show } from 'solid-js';
import { useChannelTab } from './ChannelTabContext';
import { CHANNEL_TABS, isChannelInfoTab } from './channel-tabs';
import { useChannelTabItems } from './use-channel-tab-items';

/** Keeps channel information beside the conversation, or over it in a narrow split. */
export function ChannelInfoPanel(props: ParentProps<{ channelId: string }>) {
  const { infoPanel } = useChannelTab();
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
          class="absolute inset-y-0 right-0 z-20 w-full max-w-96 min-h-0 flex-col border-l border-edge-muted bg-surface @min-[800px]/channel-detail:static @min-[800px]/channel-detail:w-96 @min-[800px]/channel-detail:shrink-0"
          classList={{ flex: panel().isOpen() }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            event.preventDefault();
            event.stopPropagation();
            panel().close();
          }}
        >
          <div class="flex h-12 shrink-0 items-center justify-between px-4">
            <h2 class="text-sm font-semibold">Channel details</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close channel details"
              onClick={() => panel().close()}
            >
              <XIcon />
            </Button>
          </div>
          <div class="shrink-0 px-3 pb-3">
            <Tabs
              variant="segmented"
              fullWidth
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
