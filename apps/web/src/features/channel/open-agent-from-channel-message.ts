import { openChatWithInput } from '@app/features/chat/ChatWithAgentButton';
import type { MessageData } from '@core/messages/types';
import { Telemetry } from '@macro-inc/observability';
import { buildMessageQuoteMarkdown } from './Thread/utils/message-actions';

/** Open the same unsent draft from the hover toolbar and touch action drawer. */
export async function openAgentFromChannelMessage(
  channelId: string,
  message: MessageData
) {
  if (message.deleted_at) return;
  await Telemetry.span('channel.message.open_agent', async (span) => {
    span.setAttr('channel.id', channelId);
    span.setAttr('message.id', message.id);
    const quote = buildMessageQuoteMarkdown({
      parent: { type: 'channel', id: channelId },
      message,
    });
    const opened = await openChatWithInput(
      `${quote}\n\nFigure out and implement this`
    );
    span.setAttr('agent.session.opened', opened);
    if (!opened) span.error('Unable to open agent session');
  });
}
