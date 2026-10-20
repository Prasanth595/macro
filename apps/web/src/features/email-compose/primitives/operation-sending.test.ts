import { createSignal } from 'solid-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { MessageOperation } from '../../email-message/core/message-operation';
import { message } from '../../email-message/tests/messages';
import { createComposeContext } from '../tests/capabilities';
import { mountEmailComposer } from '../tests/composer';
import { mountReplyComposer } from '../tests/reply';

beforeEach(() => vi.useFakeTimers({ now: new Date('2026-09-01T12:00:00Z') }));
afterEach(() => vi.useRealTimers());

it.each(['compose', 'reply'] as const)(
  'shows a retried provider send in the %s send button',
  (kind) => {
    const context = createComposeContext();
    const [operation, setOperation] = createSignal<MessageOperation>({
      state: 'SUBMITTING',
      revision: '1',
    });
    context.operations = () => ({ operation, resolve: async () => {} });
    context.setDraftLifecycle({
      type: 'editing',
      draftId: 'retried-draft',
      threadId: 'thread',
      inboxId: 'inbox',
      observedAt: Date.now(),
    });
    const draft = message('retried-draft', {
      is_draft: true,
      operation: operation(),
    });
    const compose =
      kind === 'compose'
        ? mountEmailComposer(context, undefined, { draft })
        : undefined;
    const reply =
      kind === 'reply'
        ? mountReplyComposer(context, undefined, { draft })
        : undefined;
    const state = compose?.state.context ?? reply!;
    try {
      expect(state.isSending()).toBe(true);
      expect(state.sendUnavailableReason?.()).toBe('Sending…');
      setOperation({ state: 'CONFIRMING', revision: '2' });
      expect(state.isSending()).toBe(true);
      setOperation({
        state: 'UNCERTAIN',
        issue: 'SEND_UNKNOWN',
        revision: '3',
      });
      expect(state.isSending()).toBe(false);
      expect(state.sendUnavailableReason?.()).toBeUndefined();
    } finally {
      compose?.dispose();
      reply?.dispose();
    }
  }
);
