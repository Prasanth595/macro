import { ENABLE_EMAIL } from '@core/constant/featureFlags';
import { useSettingsState } from '@core/constant/SettingsState';
import { useSettingsTabAvailable } from '@core/constant/settingsTabsConfig';
import { usePipedreamMcpFlag } from '@core/pipedream/flag';
import { Button } from '@ui';
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
      <IntegrationsView onOpenMacroMcp={() => openSettings('Agent')}>
        <AccountConnections />
      </IntegrationsView>
    </Show>
  );
}

function AccountConnections() {
  const { openSettings } = useSettingsState();
  const isAvailable = useSettingsTabAvailable();
  return (
    <section
      data-settings-target="accounts"
      tabIndex={-1}
      class="border-b border-edge-muted pb-6 outline-none"
    >
      <div class="grid grid-cols-1 items-start gap-4 @[760px]/settings-page:grid-cols-2">
        <Show when={ENABLE_EMAIL}>
          <Suspense>
            <EmailCard />
          </Suspense>
        </Show>
        <Suspense>
          <GitHubCard />
        </Suspense>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-end gap-2">
        <Show when={ENABLE_EMAIL}>
          <Button
            variant="ghost"
            size="md"
            onClick={() => openSettings('Email')}
          >
            Email settings
          </Button>
        </Show>
        <Show when={isAvailable('Calendar')}>
          <Button
            variant="ghost"
            size="md"
            onClick={() => openSettings('Calendar')}
          >
            Calendar settings
          </Button>
        </Show>
      </div>
    </section>
  );
}
