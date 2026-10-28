import { createQueryKeys } from '@lukemorales/query-key-factory';
import type { RowLinkTarget } from '../core/row-links';

export const crmKeys = createQueryKeys('crm', {
  lists: null,
  linkedRows: (target: RowLinkTarget) => [target],
  pipelines: (teamId: string | undefined) => [teamId],
  pipelineTable: (id: string) => [id],
  pipelineRows: (id: string) => [id],
  company: (companyId: string) => [companyId],
  contact: (contactId: string) => [contactId],
  contactByEmail: (teamId: string, email: string) => [teamId, email],
  quickAccessContacts: null,
});
