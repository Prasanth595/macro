import { ENABLE_EMAIL } from '@core/constant/featureFlags';
import { useSettingsState } from '@core/constant/SettingsState';
import { useSettingsTabAvailable } from '@core/constant/settingsTabsConfig';
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
  const isAvailable = useSettingsTabAvailable();
  return (
    <section
      data-settings-target="accounts"
      tabIndex={-1}
      class="border-b border-edge-muted pb-4 outline-none"
    >
      <h2 class="mb-3 text-lg font-medium text-ink">Core Integrations</h2>
      <div class="grid grid-cols-1 items-stretch gap-4 @[760px]/settings-page:grid-cols-2">
        <Show when={ENABLE_EMAIL}>
          <Suspense>
            <EmailCard class="h-full bg-ink/4 shadow-none light-mode:shadow-none touch:bg-ink/4" />
          </Suspense>
        </Show>
        <Suspense>
          <GitHubCard class="h-full bg-ink/4 shadow-none light-mode:shadow-none touch:bg-ink/4" />
        </Suspense>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-end gap-4">
        <Show when={ENABLE_EMAIL}>
          <button
            type="button"
            class="inline-flex items-center text-sm text-ink-muted outline-none hover:text-ink hover:underline focus-visible:underline touch:min-h-[44px]"
            onClick={() => openSettings('Email')}
          >
            Email settings
          </button>
        </Show>
        <Show when={isAvailable('Calendar')}>
          <button
            type="button"
            class="inline-flex items-center text-sm text-ink-muted outline-none hover:text-ink hover:underline focus-visible:underline touch:min-h-[44px]"
            onClick={() => openSettings('Calendar')}
          >
            Calendar settings
          </button>
        </Show>
      </div>
    </section>
  );
}
