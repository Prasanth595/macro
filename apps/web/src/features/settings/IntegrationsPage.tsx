import { ENABLE_EMAIL } from '@core/constant/featureFlags';
import { useSettingsState } from '@core/constant/SettingsState';
import { usePipedreamMcpFlag } from '@core/pipedream/flag';
import { Show, Suspense } from 'solid-js';
import { IntegrationsView } from './connections/integrations-view';
import { EmailCard } from './Email';
import { GitHubCard } from './GitHub';
import { IntegrationsSection } from './Integrations';
import { SettingsPage } from './primitives';

/** Personal accounts and agent tools share one Integrations settings page. */
export function IntegrationsPage() {
  const pipedreamMcp = usePipedreamMcpFlag();
  const { openSettings } = useSettingsState();
  return (
    <Show
      when={pipedreamMcp()}
      fallback={
        <SettingsPage title="Integrations">
          <AccountConnections />
          <Suspense>
            <IntegrationsSection />
          </Suspense>
        </SettingsPage>
      }
    >
      <IntegrationsView
        onOpenMacroMcp={() => openSettings('Agent')}
        onOpenLocalAgents={() => openSettings('Harness')}
      >
        <AccountConnections />
      </IntegrationsView>
    </Show>
  );
}

function AccountConnections() {
  const { openSettings } = useSettingsState();
  return (
    <section
      data-settings-target="accounts"
      tabIndex={-1}
      class="border-b border-edge-muted pb-5 outline-none"
    >
      <h2 class="mb-2 text-lg font-medium text-ink">Core Integrations</h2>
      <div class="grid grid-cols-1 items-stretch gap-3 @[760px]/settings-page:grid-cols-2">
        <Show when={ENABLE_EMAIL}>
          <Suspense>
            <EmailCard
              class="h-full bg-ink/4 shadow-none light-mode:shadow-none touch:bg-ink/4"
              onOpenSettings={() => openSettings('Email')}
            />
          </Suspense>
        </Show>
        <Suspense>
          <GitHubCard class="h-full bg-ink/4 shadow-none light-mode:shadow-none touch:bg-ink/4" />
        </Suspense>
      </div>
    </section>
  );
}
