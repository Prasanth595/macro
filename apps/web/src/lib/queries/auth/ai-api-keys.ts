import { throwOnErr } from '@core/util/result';
import { queryClient } from '@queries/client';
import { authServiceClient } from '@service-auth/client';
import type { AiApiKeys } from '@service-auth/generated/schemas/aiApiKeys';
import type { AiProvider } from '@service-auth/generated/schemas/aiProvider';
import { useMutation, useQuery } from '@tanstack/solid-query';

import { authKeys } from './keys';

/** Whose AI API keys: the signed-in user's own, or their team's. */
export type AiApiKeyOwner = 'personal' | 'team';

const queryKey = (owner: AiApiKeyOwner) =>
  owner === 'personal'
    ? authKeys.aiApiKeys.queryKey
    : authKeys.teamAiApiKeys.queryKey;

/**
 * Which providers the signed-in user (or their team) has its own AI API key
 * for. The response never carries a key.
 */
export function useAiApiKeysQuery(
  owner: AiApiKeyOwner,
  enabled: () => boolean = () => true
) {
  return useQuery(() => ({
    queryKey: queryKey(owner),
    enabled: enabled(),
    queryFn: () =>
      throwOnErr(() =>
        owner === 'personal'
          ? authServiceClient.getAiApiKeys()
          : authServiceClient.getTeamAiApiKeys()
      ),
  }));
}

/** Stores a key for a provider, replacing any. Team keys: admins only. */
export function useSaveAiApiKey(owner: AiApiKeyOwner) {
  return useMutation(() => ({
    mutationFn: (input: { provider: AiProvider; apiKey: string }) =>
      throwOnErr(() =>
        owner === 'personal'
          ? authServiceClient.putAiApiKey(input.provider, input.apiKey)
          : authServiceClient.putTeamAiApiKey(input.provider, input.apiKey)
      ),
    onSuccess: (keys: AiApiKeys) =>
      queryClient.setQueryData(queryKey(owner), keys),
  }));
}

/**
 * Forgets a key for a provider. Team keys: admins only. Does not revoke the
 * key at the provider; the settings copy says so.
 */
export function useRemoveAiApiKey(owner: AiApiKeyOwner) {
  return useMutation(() => ({
    mutationFn: (provider: AiProvider) =>
      throwOnErr(() =>
        owner === 'personal'
          ? authServiceClient.deleteAiApiKey(provider)
          : authServiceClient.deleteTeamAiApiKey(provider)
      ),
    onSuccess: (keys: AiApiKeys) =>
      queryClient.setQueryData(queryKey(owner), keys),
  }));
}
