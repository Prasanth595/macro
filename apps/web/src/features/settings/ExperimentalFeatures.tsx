import { useExperimentalFeatures } from '@app/features/experimental-features/experimental-features';
import { ToggleSwitch } from '@ui';
import { Show } from 'solid-js';
import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from './primitives';

export function ExperimentalFeatures() {
  const experiments = useExperimentalFeatures();
  return (
    <SettingsPage
      title="Experimental Features"
      description="Try features we’re still exploring."
    >
      <Show when={experiments.godModeAvailable()}>
        <SettingsSection>
          <SettingsCard>
            <SettingsRow
              label="God Mode"
              description={
                <>
                  Command Menu (<code>cmd + k</code>) prompts automatically turn
                  into tasks, events, emails, and more. Powered by Jev-ian
                  technology.
                </>
              }
            >
              <ToggleSwitch
                label="God Mode"
                labelClass="sr-only"
                size="md"
                checked={experiments.godMode()}
                onChange={experiments.setGodMode}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>
      </Show>
    </SettingsPage>
  );
}
