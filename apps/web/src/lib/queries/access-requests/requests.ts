import { projectKeys } from '@app/features/projects/queries/keys';
import { throwOnErr } from '@core/util/result';
import { accessRequestsClient } from '@service-storage/access-requests';
import type { ShareEntity } from '@service-storage/generated/schemas/shareEntity';
import { useQuery } from '@tanstack/solid-query';
import type { Accessor } from 'solid-js';
import { agentSessionKeys } from '../agent-session/keys';
import { callKeys } from '../call/keys';
import { queryClient } from '../client';
import { invalidateSoupEntity } from '../soup/normalized-cache';
import { databasesKeys, entityKeys } from '../storage/keys';
import { accessRequestKeys } from './keys';

export function fetchAccessRequestState(entity: ShareEntity, offset = 0) {
  return throwOnErr(() => accessRequestsClient.state(entity, offset));
}
export function invalidateAccessRequests(entity: ShareEntity) {
  return queryClient.invalidateQueries({
    queryKey: accessRequestKeys.entity(entity.entityType, entity.entityId)
      .queryKey,
  });
}
export function refreshSharedAccess(entity: ShareEntity) {
  void invalidateAccessRequests(entity);
  invalidateSoupEntity(entity.entityId);
  if (entity.entityType === 'initiative')
    void queryClient.invalidateQueries({ queryKey: projectKeys._def });
  if (entity.entityType === 'database')
    void queryClient.invalidateQueries({
      queryKey: databasesKeys.detail(entity.entityId).queryKey,
    });
  if (entity.entityType === 'call')
    void queryClient.invalidateQueries({ queryKey: callKeys._def });
  if (entity.entityType === 'agent_session')
    void queryClient.invalidateQueries({
      queryKey: agentSessionKeys.detail(entity.entityId).queryKey,
    });
  if (entity.entityType === 'project') {
    // A folder grant changes effective access on its descendants too.
    void queryClient.invalidateQueries({ queryKey: accessRequestKeys._def });
    void queryClient.invalidateQueries({ queryKey: entityKeys._def });
  }
  if (entity.entityType === 'document') {
    void queryClient.invalidateQueries({
      queryKey: entityKeys.documentMetadata(entity.entityId).queryKey,
    });
    void queryClient.invalidateQueries({
      queryKey: entityKeys.documentAccessLevel(entity.entityId).queryKey,
    });
  }
}
export function useAccessRequestState(
  entity: Accessor<ShareEntity | undefined>,
  enabled: Accessor<boolean> = () => true,
  offset: Accessor<number> = () => 0
) {
  return useQuery(() => {
    const target = entity();
    return {
      queryKey: accessRequestKeys
        .entity(target?.entityType ?? '', target?.entityId ?? '')
        ._ctx.state(offset()).queryKey,
      queryFn: () => fetchAccessRequestState(target!, offset()),
      enabled: !!target && enabled(),
      staleTime: 0,
      refetchOnMount: 'always' as const,
      refetchOnWindowFocus: 'always' as const,
      refetchOnReconnect: 'always' as const,
      refetchInterval: 30_000,
      throwOnError: false,
    };
  });
}
export { accessRequestsClient };
