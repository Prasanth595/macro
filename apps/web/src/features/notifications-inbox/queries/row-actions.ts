import { throwOnErr } from '@core/util/result';
import { refreshSharedAccess } from '@queries/access-requests/requests';
import { accessRequestsClient } from '@service-storage/access-requests';
import { ShareEntityType } from '@service-storage/generated/schemas/shareEntityType';
import type { AccessRequestAction } from '../context/notifications-inbox-context';

const shareEntityType = (type: string) =>
  Object.values(ShareEntityType).find((candidate) => candidate === type);

/**
 * Approve an access request at the level asked for, or deny it. Resolving
 * supersedes the request's notification for every reviewer.
 */
export async function resolveAccessRequest(
  action: AccessRequestAction,
  approve: boolean
): Promise<void> {
  const entityType = shareEntityType(action.entityType);
  if (!entityType) throw new Error('Access requests are not supported here');
  const entity = { entityType, entityId: action.entityId };
  await throwOnErr(() =>
    accessRequestsClient.resolve(
      entity,
      action.requestId,
      action.revision,
      approve ? action.level : null
    )
  );
  refreshSharedAccess(entity);
}
