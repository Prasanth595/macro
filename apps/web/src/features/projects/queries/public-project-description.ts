export function createPublicProjectDescriptionSession(
  _projectId: string,
  _grant: string,
  _nextGrant: (projectId: string) => Promise<string | undefined>
): never {
  throw new Error('not implemented');
}
