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
import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from './primitives';

/** Personal accounts and agent tools share one Integrations settings page. */
export function IntegrationsPage() {
  const pipedreamMcp = usePipedreamMcpFlag();
  const { openSettings } = useSettingsState();
  return (
    <Show
      when={pipedreamMcp()}
      fallback={
        <SettingsPage
          title="Integrations"
          description="Connect your accounts and tools to Macro."
        >
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
    <>
      <SettingsSection title="Accounts">
        <div class="flex flex-col gap-3">
          <Show when={ENABLE_EMAIL}>
            <Suspense>
              <EmailCard />
            </Suspense>
          </Show>
          <Suspense>
            <GitHubCard />
          </Suspense>
        </div>
      </SettingsSection>
      <SettingsSection
        title="Related settings"
        description="Manage the same accounts where you use them."
      >
        <SettingsCard>
          <Show when={ENABLE_EMAIL}>
            <SettingsRow label="Email accounts and signatures">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openSettings('Email')}
              >
                Email settings
              </Button>
            </SettingsRow>
          </Show>
          <Show when={isAvailable('Calendar')}>
            <SettingsRow label="Calendar connections and colors">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openSettings('Calendar')}
              >
                Calendar settings
              </Button>
            </SettingsRow>
          </Show>
        </SettingsCard>
      </SettingsSection>
    </>
  );
}
