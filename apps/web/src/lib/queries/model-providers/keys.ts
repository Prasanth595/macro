import { createQueryKeys } from '@lukemorales/query-key-factory';
export const modelProviderKeys = createQueryKeys('workspace-model-providers', {
  catalog: null,
  settings: (workspace: string) => [workspace],
});
