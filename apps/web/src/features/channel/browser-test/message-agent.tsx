import '@app/index.css';
import { AnalyticsContextProvider } from '@app/lib/analytics/analytics-context';
import { PosthogProvider } from '@app/lib/analytics/posthog';
import { initializeLexical } from '@core/component/LexicalMarkdown/init';
import { ChannelsContextProvider } from '@core/context/channels';
import { EmailLinksContextProvider } from '@core/context/emailLinks';
import { QuickAccessProvider } from '@core/context/quickAccess/QuickAccessProvider';
import { UserContextProvider } from '@core/context/user';
import { useHotKeyRoot } from '@core/hotkey/hotkeys';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { EntityProvider } from '@entity';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { onCleanup, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { AgentInput } from '../../block-agent/ui/AgentInput';
import { createChannelMessageActions } from '../Channel/create-channel-message-actions';
import { ChannelMessage } from '../Message/ChannelMessage';
import { MaybeMessageActionDrawerManager } from '../Mobile/MessageActionDrawerManager';
import { openAgentFromChannelMessage } from '../open-agent-from-channel-message';
import { initialInput } from './session';

initializeLexical();
document.documentElement.dataset.touchDevice = String(isTouchDevice());

const message = {
  id: 'fixture-message',
  thread_id: new URLSearchParams(location.search).has('reply')
    ? 'fixture-thread'
    : undefined,
  content: 'Fix the layout for narrow screens.',
  sender_id: 'fixture-sender',
  created_at: '2026-02-25T12:00:00.000Z',
  updated_at: '2026-02-25T12:00:00.000Z',
  attachments: [],
  reactions: [],
};

function Messages() {
  const actions = createChannelMessageActions({
    parent: () => ({ type: 'channel', id: 'fixture-channel' }),
    userId: () => 'fixture-viewer',
    deleteMessage: () => {},
    addReaction: () => {},
    removeReaction: () => {},
    onChat: ({ message }) =>
      openAgentFromChannelMessage('fixture-channel', message),
  });
  return (
    <main class="min-h-screen bg-page text-ink p-4">
      <div class="flex flex-wrap gap-4">
        <section class="flex-1 min-w-72 border border-edge-muted rounded-xl p-4">
          <h1 class="mb-12 font-semibold">Channel messages</h1>
          <MaybeMessageActionDrawerManager>
            <ChannelMessage message={message} actions={actions(message)} />
          </MaybeMessageActionDrawerManager>
        </section>
        <Show when={initialInput()}>
          {(input) => (
            <section
              aria-label="New agent session"
              class="flex-1 min-w-72 border border-edge-muted rounded-xl p-4"
            >
              <h2 class="mb-4 font-semibold">New agent session</h2>
              <AgentInput initialInput={input()} onSend={() => {}} />
            </section>
          )}
        </Show>
      </div>
    </main>
  );
}

function Fixture() {
  useHotKeyRoot();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  onCleanup(() => client.clear());
  return (
    <QueryClientProvider client={client}>
      <AnalyticsContextProvider>
        <PosthogProvider>
          <EntityProvider>
            <UserContextProvider>
              <EmailLinksContextProvider>
                <ChannelsContextProvider>
                  <QuickAccessProvider>
                    <Messages />
                  </QuickAccessProvider>
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
render(() => <Fixture />, root);
