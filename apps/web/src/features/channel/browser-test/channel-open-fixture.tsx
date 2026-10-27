// The app reaches the composer before its attachment row; evaluate it first
// so the Input module cycle resolves in the same order.
import '@channel/Input/Input';
import '@app/index.css';
import { MeetingSessionProvider } from '@app/features/meetings/meeting-session-provider';
import { AnalyticsContextProvider } from '@app/lib/analytics/analytics-context';
import { PosthogProvider } from '@app/lib/analytics/posthog';
import { CallProvider } from '@channel/Call/CallContext';
import { AppProviders } from '@components/app/AppProviders';
import { ItemDndProvider } from '@components/app/ItemDragAndDrop';
import { ChannelsContextProvider } from '@core/context/channels';
import { EmailLinksContextProvider } from '@core/context/emailLinks';
import { QuickAccessProvider } from '@core/context/quickAccess/QuickAccessProvider';
import { UserContextProvider } from '@core/context/user';
import { useHotKeyRoot } from '@core/hotkey/hotkeys';
import { EntityProvider } from '@entity';
import { queryClient } from '@queries/client';
import { MemoryRouter, Route } from '@solidjs/router';
import { QueryClientProvider } from '@tanstack/solid-query';
import { createSignal, For, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { ChannelLoading } from '../Channel/ChannelLoading';
import { ChannelMessages, ChannelSurface } from '../Channel/ChannelSurface';
import { ChannelTabProvider } from '../Channel/ChannelTabContext';
import { DebugSuspense } from '../DebugSuspense';

const CHANNELS = ['channel-a', 'channel-b'];

/**
 * The real channel surface, mounted the way a channel detail pane mounts it:
 * keyed by channel, so switching disposes the previous channel first. The
 * providers are the app shell's, in the order `routes/Root.tsx` mounts them.
 */
function Fixture() {
  useHotKeyRoot();
  const [channelId, setChannelId] = createSignal<string>();
  return (
    <QueryClientProvider client={queryClient}>
      <AnalyticsContextProvider>
        <PosthogProvider>
          <EntityProvider>
            <UserContextProvider>
              <EmailLinksContextProvider>
                <ChannelsContextProvider>
                  <CallProvider>
                    <QuickAccessProvider>
                      <MeetingSessionProvider>
                        <AppProviders>
                          <ItemDndProvider>
                            <main class="flex h-screen bg-surface text-ink">
                              <nav class="flex w-48 flex-col gap-2 p-2">
                                <For each={CHANNELS}>
                                  {(id) => (
                                    <button
                                      type="button"
                                      onClick={() => setChannelId(id)}
                                    >
                                      Open {id}
                                    </button>
                                  )}
                                </For>
                              </nav>
                              <section class="flex min-w-0 flex-1 flex-col">
                                <Show when={channelId()} keyed>
                                  {(id) => (
                                    <ChannelSurface channelId={id}>
                                      <ChannelTabProvider
                                        activeTab={() => 'messages'}
                                        setActiveTab={() => {}}
                                      >
                                        <div
                                          class="flex min-h-0 flex-1 flex-col px-2"
                                          data-channel-tab-content
                                        >
                                          <DebugSuspense
                                            name="fixture.messages"
                                            fallback={<ChannelLoading />}
                                          >
                                            <ChannelMessages
                                              autofocus={false}
                                            />
                                          </DebugSuspense>
                                        </div>
                                      </ChannelTabProvider>
                                    </ChannelSurface>
                                  )}
                                </Show>
                              </section>
                            </main>
                          </ItemDndProvider>
                        </AppProviders>
                      </MeetingSessionProvider>
                    </QuickAccessProvider>
                  </CallProvider>
                </ChannelsContextProvider>
              </EmailLinksContextProvider>
            </UserContextProvider>
          </EntityProvider>
        </PosthogProvider>
      </AnalyticsContextProvider>
    </QueryClientProvider>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Fixture root missing');
render(
  () => (
    <MemoryRouter>
      <Route path="*" component={Fixture} />
    </MemoryRouter>
  ),
  root
);
