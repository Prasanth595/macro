import { beforeEach, expect, it, vi } from 'vitest';

const doubles = vi.hoisted(() => ({
  source: vi.fn(),
  session: vi.fn(),
}));
vi.mock('@service-sync/source', () => ({
  createCollabSurfaceSource: doubles.source,
}));
vi.mock('./project-description', () => ({
  createProjectDescriptionSession: doubles.session,
}));

import type { ProjectDescriptionTransport } from './project-description';
import { createPublicProjectDescriptionSession } from './public-project-description';

const nextGrant = vi.fn(async (_projectId: string) => 'grant-2');

function transport(): ProjectDescriptionTransport<string> {
  createPublicProjectDescriptionSession('project-1', 'grant-1', nextGrant);
  const [surfaceId, port] = doubles.session.mock.calls[0];
  expect(surfaceId).toBe('project-1');
  return port;
}

beforeEach(() => vi.clearAllMocks());

it('connects with the grant the project read handed out', async () => {
  await expect(
    transport().authorize('project-1', new AbortController().signal)
  ).resolves.toBe('grant-1');
  expect(nextGrant).not.toHaveBeenCalled();
});

it('asks the project, not the token route, for the next grant', async () => {
  transport().connect('project-1', 'grant-1');
  const [surfaceId, token, refresh] = doubles.source.mock.calls[0];
  expect([surfaceId, token]).toEqual(['project-1', 'grant-1']);
  await expect(refresh()).resolves.toBe('grant-2');
  expect(nextGrant).toHaveBeenCalledWith('project-1');
});
