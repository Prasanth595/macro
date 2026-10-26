import { propertiesServiceClient } from '@service-properties/client';
import { dssFetch } from '@service-storage/client';
import {
  createInitiativeDescriptionTokenResponse,
  getInitiativeOverviewResponse,
} from '@service-storage/generated/zod';
import { type PublicProject, publicProject } from '../public/public-project';

export type PublicProjectRead =
  | { status: 'ready'; project: PublicProject }
  | { status: 'unavailable' }
  | { status: 'failed' };

const UNAVAILABLE = new Set(['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND']);

/** Read a project as a visitor; one the visitor may not view is unavailable. */
export async function loadPublicProject(
  projectId: string
): Promise<PublicProjectRead> {
  const [overview, properties] = await Promise.all([
    dssFetch<Record<string, unknown>>(`/initiatives/${projectId}/overview`),
    propertiesServiceClient.getEntityProperties({
      entity_type: 'INITIATIVE',
      entity_id: projectId,
      query: { include_metadata: true },
    }),
  ]);
  if (overview.isErr())
    return overview.error.some((error) => UNAVAILABLE.has(error.code))
      ? { status: 'unavailable' }
      : { status: 'failed' };
  const parsed = getInitiativeOverviewResponse.safeParse(overview.value);
  if (!parsed.success || properties.isErr()) return { status: 'failed' };
  return {
    status: 'ready',
    project: publicProject(parsed.data, properties.value.properties),
  };
}

/** A fresh read-only grant on the project description, once the last one expires. */
export async function nextPublicDescriptionGrant(
  projectId: string
): Promise<string | undefined> {
  const result = await dssFetch<Record<string, unknown>>(
    `/initiatives/${projectId}/description/token`,
    { method: 'POST' }
  );
  if (result.isErr()) return undefined;
  const reader = createInitiativeDescriptionTokenResponse.safeParse(
    result.value
  );
  return reader.success && reader.data.state === 'live'
    ? reader.data.token
    : undefined;
}
