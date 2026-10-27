import { throwOnErr } from '@core/util/result';
import { storageServiceClient } from '@service-storage/client';
import type { GithubTaskStatusPolicy } from '@service-storage/generated/schemas/githubTaskStatusPolicy';
import { useMutation, useQuery } from '@tanstack/solid-query';
import type { Accessor } from 'solid-js';
import { queryClient } from '../client';
import {
  githubTaskStatusAutomationKeys,
  taskGithubReferenceKeys,
} from './keys';

export function useGithubTaskStatusAutomationQuery(enabled: Accessor<boolean>) {
  return useQuery(() => ({
    queryKey: githubTaskStatusAutomationKeys.current.queryKey,
    queryFn: () =>
      throwOnErr(() => storageServiceClient.getGithubTaskStatusAutomation()),
    enabled: enabled(),
  }));
}

export function usePutGithubTaskStatusAutomationMutation() {
  return useMutation(() => ({
    mutationFn: (body: GithubTaskStatusPolicy) =>
      throwOnErr(() =>
        storageServiceClient.putGithubTaskStatusAutomation(body)
      ),
    onSuccess: (policy) => {
      queryClient.setQueryData(
        githubTaskStatusAutomationKeys.current.queryKey,
        policy
      );
    },
  }));
}

export function useTaskGithubReferenceQuery(documentId: Accessor<string>) {
  return useQuery(() => ({
    queryKey: taskGithubReferenceKeys.detail(documentId()).queryKey,
    queryFn: async () => {
      const result = await throwOnErr(() =>
        storageServiceClient.getDocumentBranchName({ documentId: documentId() })
      );
      return result.taskReference;
    },
    enabled: documentId().length > 0,
  }));
}
