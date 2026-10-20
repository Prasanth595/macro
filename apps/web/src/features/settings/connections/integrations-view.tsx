import { toast } from '@core/component/Toast/Toast';
import {
  clearPendingConnectApp,
  pendingConnectApp,
} from '@core/pipedream/pendingConnect';
import { fireAndForget } from '@core/util/fireAndForget';
import { connectPipedreamApp } from '@queries/pipedream-connectors';
import { Button } from '@ui';
import {
  createEffect,
  createSignal,
  on,
  type ParentProps,
  Show,
  Suspense,
} from 'solid-js';
import { SettingsPage, SettingsSection } from '../primitives';
import { ConnectedView } from './ConnectedView';
import { DiscoverView } from './DiscoverView';
import { capabilitiesFor } from './model';
import { PipedreamAiProvider } from './PipedreamAiProvider';
import { SlackChannelImportFlow } from './slack-channel-import/SlackChannelImportFlow';
import { useConnectionsModel } from './use-connections-model';
import { ConnectionsViewProvider, useConnectionsView } from './view-state';

function MacroMcpSignpost(props: { onOpen: () => void }) {
  return (
    <p class="text-xs text-ink-muted text-balance">
      Looking to use Macro in another app?{' '}
      <button
        type="button"
        class="text-link outline-none hover:text-link-hover hover:underline focus-visible:underline"
        onClick={props.onOpen}
      >
        Macro MCP
      </button>
    </p>
  );
}

type IntegrationsViewProps = ParentProps<{
  onOpenMacroMcp: () => void;
}>;

export function IntegrationsView(props: IntegrationsViewProps) {
  return (
    <ConnectionsViewProvider>
      <ConnectionsContent {...props} />
    </ConnectionsViewProvider>
  );
}

function ConnectionsContent(props: IntegrationsViewProps) {
  const { model, ready, error, partialError, retry } = useConnectionsModel();
  const view = useConnectionsView();
  const [importSlackChannels, setImportSlackChannels] = createSignal(false);
  // External entry points request a connector or the complete channel import flow.
  createEffect(
    on(pendingConnectApp, (requested) => {
      if (!requested) return;
      clearPendingConnectApp();
      if (requested.intent === 'import-slack-channels') {
        setImportSlackChannels(true);
        return;
      }
      fireAndForget(
        connectRequestedApp(requested.appSlug),
        'connections-settings'
      );
    })
  );
  async function connectRequestedApp(appSlug: string) {
    try {
      const outcome = await connectPipedreamApp({ appSlug });
      if (outcome === 'unsupported')
        toast.failure('Connectors are not available on this deployment');
    } catch {
      toast.failure(`Failed to connect ${appSlug}`);
    }
  }
  const slackConnected = () =>
    capabilitiesFor(model(), 'slack').some(
      (capability) =>
        capability.mechanism === 'pipedream' &&
        capability.status === 'connected'
    );
  const description = 'Connect your accounts and tools to Macro.';

  return (
    <Show
      when={importSlackChannels()}
      fallback={
        <Show
          when={!error()}
          fallback={
            <SettingsPage
              title="Integrations"
              description={description}
              onBack={view.provider() ? view.closeProvider : undefined}
              backLabel="Integrations"
            >
              {props.children}
              <div class="flex items-center gap-3 text-sm text-ink-muted">
                Couldn't load Connections.
                <Button variant="outline" size="sm" depth={3} onClick={retry}>
                  Retry
                </Button>
              </div>
            </SettingsPage>
          }
        >
          <Show
            when={ready() && view.provider()}
            keyed
            fallback={
              <SettingsPage
                title="Integrations"
                description={description}
                signpost={<MacroMcpSignpost onOpen={props.onOpenMacroMcp} />}
              >
                <Show when={partialError()}>
                  <div
                    role="status"
                    class="flex items-center gap-3 text-sm text-ink-muted"
                  >
                    Some connections couldn't be loaded.
                    <Button
                      variant="outline"
                      size="sm"
                      depth={3}
                      onClick={retry}
                    >
                      Retry
                    </Button>
                  </div>
                </Show>
                <Show
                  when={ready()}
                  fallback={
                    <p class="text-sm text-ink-muted">Loading Connections…</p>
                  }
                >
                  <div class="grid min-w-0 grid-cols-1 items-start gap-10 @[760px]/settings-page:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                    <div class="flex min-w-0 flex-col gap-10">
                      <SettingsSection
                        title="Installed"
                        description="Manage the tools connected to Macro."
                      >
                        <ConnectedView model={model()} />
                      </SettingsSection>
                      {props.children}
                    </div>
                    <SettingsSection
                      title="Discover"
                      description="Find tools for your agents to work with."
                      class="min-w-0"
                    >
                      <DiscoverView model={model()} />
                    </SettingsSection>
                  </div>
                </Show>
              </SettingsPage>
            }
          >
            {(provider) => (
              <PipedreamAiProvider model={model()} provider={provider} />
            )}
          </Show>
        </Show>
      }
    >
      <Show
        when={ready()}
        fallback={
          <p class="text-sm text-ink-muted">Loading Slack connection…</p>
        }
      >
        <Suspense>
          <SlackChannelImportFlow
            connected={slackConnected()}
            onBack={() => setImportSlackChannels(false)}
          />
        </Suspense>
      </Show>
    </Show>
  );
}
