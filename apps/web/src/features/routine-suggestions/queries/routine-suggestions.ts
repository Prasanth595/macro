import { FREE_DEFAULT_MODEL } from '@core/component/AI/constant';
import { PERMISSION_IDS } from '@core/constant/permissions';
import { useHasPermission, useUserId } from '@core/context/user';
import { getDefaultTimezone } from '@core/util/cron';
import type { CreateAIProjectionOptions } from '@queries/ai/projection';
import { createAIProjection, warmAIProjection } from '@queries/ai/projection';
import { createMemo } from 'solid-js';
import {
  buildRoutineSuggestionsPrompt,
  decodeRoutineSuggestions,
  type RoutineSuggestion,
  routineSuggestionsSchema,
} from '../core/suggestions';

/**
 * Suggestions come from one projection per plan: the definition is shared by
 * every user under its id, so each id pins one model. Premium users get the
 * server's default model; everyone else the free-tier model.
 */
function projectionOptions(
  premium: boolean
): Omit<CreateAIProjectionOptions<typeof routineSuggestionsSchema>, 'enabled'> {
  return {
    id: premium ? 'routines/suggestions' : 'routines/suggestions-free',
    prompt: buildRoutineSuggestionsPrompt(),
    schema: routineSuggestionsSchema,
    ...(premium ? {} : { model: FREE_DEFAULT_MODEL }),
    // Regenerated every few days, and kept alive for a month without visits.
    refreshCadence: 'low',
    expiry: 'month',
  };
}

export type RoutineSuggestionsSource = {
  /** Undefined until a result exists; stale results stay while refreshing. */
  suggestions(): RoutineSuggestion[] | undefined;
  /** A generation is running (first time or a refresh). */
  generating(): boolean;
  error(): string | undefined;
  refresh(): Promise<unknown>;
};

/** The workspace's routine suggestions, from the cached AI projection. */
export function createRoutineSuggestions(): RoutineSuggestionsSource {
  const premium = useHasPermission(PERMISSION_IDS.READ_PROFESSIONAL_FEATURES);
  const userId = useUserId();
  // Permissions arrive with the user; asking earlier would start the wrong
  // plan's projection for a premium user.
  const projection = createAIProjection(() => ({
    ...projectionOptions(premium()),
    enabled: userId() !== undefined,
  }));
  const suggestions = createMemo(() => {
    const data = projection.data();
    if (data === undefined || typeof data === 'string') return undefined;
    return decodeRoutineSuggestions(data, getDefaultTimezone());
  });
  return {
    suggestions,
    generating: projection.isGenerating,
    error: projection.error,
    refresh: projection.refresh,
  };
}

/** Starts generating suggestions, e.g. as soon as onboarding completes. */
export function createRoutineSuggestionsWarmup(): () => Promise<void> {
  const premium = useHasPermission(PERMISSION_IDS.READ_PROFESSIONAL_FEATURES);
  return () => warmAIProjection(projectionOptions(premium()));
}
