import { FREE_DEFAULT_MODEL } from '@core/component/AI/constant';
import { getDefaultTimezone } from '@core/util/cron';
import type { CreateAIProjectionOptions } from '@queries/ai/projection';
import { createAIProjection, warmAIProjection } from '@queries/ai/projection';
import { type Accessor, createMemo } from 'solid-js';
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
export function createRoutineSuggestions(plan: {
  /**
   * Whether to read the premium-model projection. Onboarding passes false
   * whatever the plan: it warms the free one before the user picks a plan.
   */
  premium: Accessor<boolean>;
  /**
   * Whether the user, and so their permissions, has loaded; asking earlier
   * would start the wrong plan's projection for a premium user.
   */
  ready: Accessor<boolean>;
}): RoutineSuggestionsSource {
  const projection = createAIProjection(() => ({
    ...projectionOptions(plan.premium()),
    enabled: plan.ready(),
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

/**
 * Starts generating the free-model suggestions onboarding shows, once the
 * user's inbox and tools are connected, so they are ready by its last step.
 */
export function warmOnboardingRoutineSuggestions(): Promise<void> {
  return warmAIProjection(projectionOptions(false));
}
