import { useFeatureFlag } from '@app/lib/analytics/posthog';
import {
  enableExperimentalFeatures,
  enableUniversalInput,
} from '@core/constant/featureFlags';
import { useEmail, useUserId } from '@core/context/user';
import { experimentalFeaturesAvailable } from './core/access';
import { createExperimentalPreferences } from './primitives/preferences';

/** Separate Settings visibility from Command K availability, sharing one account preference. */
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
    godMode: () => godModeAvailable() && preferences.godMode(),
    setGodMode: (enabled: boolean) => {
      if (available() && godModeAvailable()) preferences.setGodMode(enabled);
    },
  };
}
