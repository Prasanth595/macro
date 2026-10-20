import { usePreference } from '@app/preferences/use-preference';
import { ChannelTopIcon } from '@channel/components/ChannelTopIcon';
import { Resize } from '@core/component/Resize/Resize';
import { useChannelName, useChannelType } from '@core/context/channels';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { Accordion } from '@kobalte/core/accordion';
import CaretRightIcon from '@phosphor/caret-right.svg';
import XIcon from '@phosphor/x.svg';
import { useChannelParticipantsQuery } from '@queries/channel/channel-participants';
import { Button } from '@ui';
import { For, type JSX, type ParentProps, Show } from 'solid-js';
import { useChannelTab } from './ChannelTabContext';
import {
  CHANNEL_TABS,
  type ChannelInfoTab,
  isChannelInfoTab,
} from './channel-tabs';
import { useChannelTabItems } from './use-channel-tab-items';

/** The full channel column resizes with its details, including the top bar. */
export function ChannelInfoLayout(props: ParentProps<{ panel: JSX.Element }>) {
  const { infoPanel } = useChannelTab();
  const [width, setWidth] = usePreference('macro:pref:channels:details-width', {
    default: 480,
  });

  return (
    <Show
      when={!isTouchDevice() && infoPanel}
      fallback={<div class="flex size-full min-h-0">{props.children}</div>}
    >
      {(panel) => (
        <div ref={panel().layoutRef} class="size-full min-h-0 min-w-0">
          <Resize.Zone direction="horizontal" gutter={1}>
            <Resize.Panel id="channel-main" index={0} minSize={320}>
              {props.children}
            </Resize.Panel>
            <Resize.Panel
              id="channel-details"
              index={1}
              minSize={320}
              maxSize={960}
              target={{ kind: 'px', px: width() }}
              redistributionPreferredSize={width()}
              collapsed={() => !panel().isOpen()}
              onSizeChangeEnd={setWidth}
            >
              {props.panel}
            </Resize.Panel>
          </Resize.Zone>
        </div>
      )}
    </Show>
  );
}

/** Full-height channel information beside both the conversation and its header. */
export function ChannelInfoPanel(props: {
  channelId: string;
  fallbackName?: string;
  children: (section: ChannelInfoTab) => JSX.Element;
}) {
  const { infoPanel } = useChannelTab();
  const name = useChannelName(props.channelId, props.fallbackName);
  const channelType = useChannelType(props.channelId);
  const participantsQuery = useChannelParticipantsQuery(() => props.channelId);
  const participants = () =>
    participantsQuery.isSuccess ? (participantsQuery.data ?? []) : [];
  const availableTabs = useChannelTabItems(props.channelId);
  const sections = () =>
    CHANNEL_TABS.flatMap((tab) => {
      const value = tab.value;
      return isChannelInfoTab(value) &&
        availableTabs().some((available) => available.value === value)
        ? [{ value, label: tab.label }]
        : [];
    });

  return (
    <Show when={infoPanel}>
      {(panel) => (
        <aside
          id={panel().id}
          aria-label="Channel details"
          data-channel-info-panel
          inert={!panel().isOpen()}
          aria-hidden={!panel().isOpen()}
          class="flex size-full min-h-0 min-w-0 flex-col p-3"
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            event.preventDefault();
            event.stopPropagation();
            panel().close();
          }}
        >
          <div class="flex max-h-full min-h-0 flex-col overflow-hidden rounded-xl border border-edge-frame bg-surface shadow-menu">
            <div class="flex shrink-0 items-center gap-3 border-b border-edge-muted p-3">
              <ChannelTopIcon
                channelId={props.channelId}
                channelType={channelType()}
                participants={participants()}
              />
              <div class="min-w-0 flex-1">
                <h2 class="text-sm font-medium leading-tight break-words">
                  {name() ?? 'New Channel'}
                </h2>
                <Show when={participantsQuery.isSuccess}>
                  <p class="mt-1 text-xs text-ink-muted">
                    {participants().length} participants
                  </p>
                </Show>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close channel details"
                onClick={() => panel().close()}
              >
                <XIcon />
              </Button>
            </div>
            <div class="min-h-0 overflow-y-auto overscroll-contain">
              <Accordion
                multiple
                collapsible
                value={panel().openSections()}
                onChange={(values) =>
                  panel().setOpenSections(values.filter(isChannelInfoTab))
                }
              >
                <For each={sections()}>
                  {(section) => (
                    <Accordion.Item
                      value={section.value}
                      class="border-b border-edge-muted last:border-b-0"
                    >
                      <Accordion.Header>
                        <Accordion.Trigger class="group flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm text-ink-muted outline-none hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                          {section.label}
                          <CaretRightIcon class="size-3 shrink-0 transition-transform duration-90 group-data-expanded:rotate-90 motion-reduce:transition-none" />
                        </Accordion.Trigger>
                      </Accordion.Header>
                      <Accordion.Content class="overflow-hidden data-expanded:animate-accordion-down data-closed:animate-accordion-up motion-reduce:animate-none">
                        <Show when={panel().isPresent()}>
                          {props.children(section.value)}
                        </Show>
                      </Accordion.Content>
                    </Accordion.Item>
                  )}
                </For>
              </Accordion>
            </div>
          </div>
        </aside>
      )}
    </Show>
  );
}
