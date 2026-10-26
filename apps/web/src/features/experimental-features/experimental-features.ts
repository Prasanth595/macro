import { useFeatureFlag } from '@app/lib/analytics/posthog';
import {
  enableExperimentalFeatures,
  enableUniversalInput,
} from '@core/constant/featureFlags';
import { useEmail, useUserId } from '@core/context/user';
import { experimentalFeaturesAvailable } from './core/access';
import { createExperimentalPreferences } from './primitives/preferences';

/** Gate experimental settings and Command K through the same account preference. */
export function useExperimentalFeatures() {
  const flag = useFeatureFlag(enableExperimentalFeatures);
  const universal = useFeatureFlag(enableUniversalInput);
  const email = useEmail();
  const preferences = createExperimentalPreferences(useUserId());
  const available = () =>
    !flag().loading && experimentalFeaturesAvailable(email(), flag().enabled);
  const godModeAvailable = () => !universal().loading && universal().enabled;
  return {
    available,
    godModeAvailable,
    godMode: () => available() && godModeAvailable() && preferences.godMode(),
    setGodMode: (enabled: boolean) => {
      if (available() && godModeAvailable()) preferences.setGodMode(enabled);
    },
  };
}
