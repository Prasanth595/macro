/**
 * A CRM deal discussion parent. Added beside the generated message-parent
 * union so a deal can host comments the same way a company does.
 */
export type MessageParentCrmDeal = {
  id: string;
  type: 'crm_deal';
};
