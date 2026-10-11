import {
  modelProviderClient,
  type ProviderInput,
  type ProviderSettingsInput,
} from '@service-cognition/model-providers';
import { useMutation, useQuery } from '@tanstack/solid-query';
import type { Accessor } from 'solid-js';
import { queryClient } from './client';
import { modelProviderKeys } from './model-providers/keys';

const catalogKey = modelProviderKeys.catalog.queryKey;
const settingsOptions = (teamId?: string) => ({
  queryKey: modelProviderKeys.settings(teamId ?? 'personal').queryKey,
  queryFn: () => modelProviderClient.settings(teamId),
});
export const useProviderSettings = (teamId: Accessor<string | undefined>) =>
  useQuery(() => settingsOptions(teamId()));
export const useWorkspaceModels = () =>
  useQuery(() => ({
    queryKey: catalogKey,
    queryFn: modelProviderClient.catalog,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  }));
export const useSaveProviderSettings = () =>
  useMutation(() => ({
    mutationFn: ({
      input,
      teamId,
    }: {
      input: ProviderSettingsInput;
      teamId?: string;
    }) => modelProviderClient.save(input, teamId),
    onSuccess: (settings, args) => {
      queryClient.setQueryData(settingsOptions(args.teamId).queryKey, settings);
      return queryClient.invalidateQueries({ queryKey: catalogKey });
    },
  }));
export const useDiscoverProviderModels = () =>
  useMutation(() => ({
    mutationFn: ({
      input,
      teamId,
    }: {
      input: ProviderInput;
      teamId?: string;
    }) => modelProviderClient.discover(input, teamId),
  }));
