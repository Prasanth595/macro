import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { MessageOperation } from '../../email-message/core/message-operation';
import { message } from '../../email-message/tests/messages';
import { createComposeContext } from '../tests/capabilities';
import { mountEmailComposer } from '../tests/composer';
import { mountReplyComposer } from '../tests/reply';

beforeEach(() => vi.useFakeTimers({ now: new Date('2026-09-01T12:00:00Z') }));
afterEach(() => vi.useRealTimers());

function mountDraft(
  kind: 'compose' | 'reply',
  operation: MessageOperation | null
) {
  const context = createComposeContext();
  context.operations = () => ({ operation: () => operation, resolve: vi.fn() });
  context.setDraftLifecycle({
    type: 'editing',
    draftId: 'draft',
    threadId: 'thread',
    inboxId: 'inbox',
    observedAt: Date.now(),
  });
  const draft = message('draft', { is_draft: true, operation });
  const compose =
    kind === 'compose'
      ? mountEmailComposer(context, undefined, { draft })
      : undefined;
  const reply =
    kind === 'reply'
      ? mountReplyComposer(context, undefined, { draft })
      : undefined;
  return {
    context,
    edit: (text: string) => (compose ?? reply)?.edit(text),
    async send() {
      const sent = compose
        ? compose.state.context.onSend()
        : reply?.sendEmail();
      await vi.advanceTimersByTimeAsync(0);
      await sent;
    },
    dispose() {
      compose?.dispose();
      reply?.dispose();
    },
  };
}

it.each(['compose', 'reply'] as const)(
  'keeps a %s draft the provider rejected editable but does not send it',
  async (kind) => {
    const draft = mountDraft(kind, {
      state: 'FAILED',
      issue: 'INVALID_CONTENT',
      revision: '3',
    });
    try {
      draft.edit('Correct the rejected draft');
      await vi.advanceTimersByTimeAsync(600);
      expect(draft.context.drafts.saveDraft).toHaveBeenCalled();
      await draft.send();
      expect(draft.context.delivery.sendMessage).not.toHaveBeenCalled();
    } finally {
      draft.dispose();
    }
  }
);

it.each([
  ['compose', 'a Gmail draft without a mailbox operation', null],
  ['reply', 'a Gmail draft without a mailbox operation', null],
  ['compose', 'a synchronized Outlook draft', { state: 'SYNCHRONIZED' }],
  ['reply', 'a synchronized Outlook draft', { state: 'SYNCHRONIZED' }],
] as const)('sends from %s for %s', async (kind, _label, seeded) => {
  const draft = mountDraft(kind, seeded && { ...seeded, revision: '3' });
  try {
    draft.edit('Ready to deliver');
    await draft.send();
    expect(draft.context.delivery.sendMessage).toHaveBeenCalled();
  } finally {
    draft.dispose();
  }
});
