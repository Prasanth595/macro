import { createCollabSurfaceSource } from '@service-sync/source';
import { createProjectDescriptionSession } from './project-description';

/**
 * Open a description a visitor may only read, with the grant the project read
 * handed out. Nothing ensures the surface, and a later grant comes from the
 * project rather than the signed-in token route.
 */
export function createPublicProjectDescriptionSession(
  projectId: string,
  grant: string,
  nextGrant: (projectId: string) => Promise<string | undefined>
) {
  return createProjectDescriptionSession(projectId, {
    authorize: async () => grant,
    connect: (surfaceId, token) =>
      createCollabSurfaceSource(surfaceId, token, () => nextGrant(surfaceId)),
  });
}
