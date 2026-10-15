import { throwOnErr } from '@core/util/result';
import { accessRequestKeys } from '@queries/access-requests/keys';
import {
  accessRequestsClient,
  invalidateAccessRequests,
  refreshSharedAccess,
  useAccessRequestState,
} from '@queries/access-requests/requests';
import { useMutation, useQuery } from '@tanstack/solid-query';
import { type Accessor, createSignal } from 'solid-js';
import { match } from 'ts-pattern';
import type { SharingSource } from '../context/contracts';
import type { AccessLevel, AccessRequest, ShareEntity } from '../core/types';

type Change =
  | { kind: 'submit'; level: AccessLevel; revision?: number }
  | { kind: 'cancel'; revision: number }
  | { kind: 'resolve'; request: AccessRequest; level: AccessLevel | null }
  | { kind: 'grant'; userId: string; level: AccessLevel | null };

export function createSharingSource(
  entity: Accessor<ShareEntity | undefined>,
  enabled: Accessor<boolean>
): SharingSource {
  const [offset, setOffset] = createSignal(0);
  const state = useAccessRequestState(entity, enabled, offset);
  const grants = useQuery(() => {
    const target = entity();
    return {
      queryKey: accessRequestKeys.entity(
        target?.entityType ?? '',
        target?.entityId ?? ''
      )._ctx.grants.queryKey,
      queryFn: () => throwOnErr(() => accessRequestsClient.grants(target!)),
      enabled:
        !!target &&
        enabled() &&
        state.isSuccess &&
        state.data.accessLevel != null,
      throwOnError: false,
    };
  });
  const mutation = useMutation(() => ({
    mutationFn: async (change: Change) => {
      const target = entity();
      if (!target) throw new Error('No item selected');
      return match(change)
        .with({ kind: 'submit' }, (change) =>
          throwOnErr(() =>
            accessRequestsClient.submit(target, change.level, change.revision)
          )
        )
        .with({ kind: 'cancel' }, (change) =>
          throwOnErr(() => accessRequestsClient.cancel(target, change.revision))
        )
        .with({ kind: 'resolve' }, (change) =>
          throwOnErr(() =>
            accessRequestsClient.resolve(
              target,
              change.request.id,
              change.request.revision,
              change.level
            )
          )
        )
        .with({ kind: 'grant' }, (change) =>
          throwOnErr(() =>
            accessRequestsClient.setGrant(target, change.userId, change.level)
          )
        )
        .exhaustive();
    },
    onSuccess: () => {
      const target = entity();
      if (target) refreshSharedAccess(target);
      setOffset(0);
    },
    onError: () => {
      const target = entity();
      if (target) void invalidateAccessRequests(target);
    },
  }));
  return {
    state: () => (state.isSuccess ? state.data : undefined),
    grants: () => (grants.isSuccess ? grants.data : []),
    loading: () => state.isLoading,
    busy: () => mutation.isPending,
    error: () =>
      mutation.isError
        ? 'Could not update access. Refresh and try again.'
        : state.isError || grants.isError
          ? 'Could not load access requests.'
          : undefined,
    async refresh() {
      mutation.reset();
      await state.refetch();
      if (state.isSuccess && state.data.accessLevel != null)
        await grants.refetch();
    },
    submit: (level, revision) =>
      mutation.mutateAsync({ kind: 'submit', level, revision }),
    cancel: (revision) => mutation.mutateAsync({ kind: 'cancel', revision }),
    resolve: (request, level) =>
      mutation.mutateAsync({ kind: 'resolve', request, level }),
    setGrant: (userId, level) =>
      mutation.mutateAsync({ kind: 'grant', userId, level }),
    nextPage: () => {
      if (state.isSuccess && state.data.nextOffset != null)
        setOffset(state.data.nextOffset);
    },
    firstPage: () => setOffset(0),
  };
}
