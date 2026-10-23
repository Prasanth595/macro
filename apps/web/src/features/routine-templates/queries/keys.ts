import { createQueryKeys } from '@lukemorales/query-key-factory';

export const routineTemplateKeys = createQueryKeys('routineTemplate', {
  detail: (params: { templateId: string }) => ({
    queryKey: [params.templateId],
  }),
  provenance: (params: { scheduleId: string }) => ({
    queryKey: [params.scheduleId],
  }),
});
