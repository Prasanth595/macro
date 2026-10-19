// Call chat shares the canonical message thread cache with every messaging surface.
export { messageKeys as callChatKeys } from '@queries/messages/keys';

export const guestCallChatKey = (callId: string, participantId: string) =>
  ['guest-call-chat', callId, participantId] as const;
