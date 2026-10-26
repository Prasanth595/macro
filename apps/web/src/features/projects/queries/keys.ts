import { createQueryKeys } from '@lukemorales/query-key-factory';

export const publicProjectKeys = createQueryKeys('public-project', {
  detail: (projectId: string) => [projectId],
});
