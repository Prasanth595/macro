import { insertMessageIntoTargetCaches } from '@queries/messages/reconcile';
import type { Message } from '@service-storage/messages';
import { createRoot, createSignal } from 'solid-js';
import { expect, it } from 'vitest';
import { createNewMessagesAbove } from '../create-new-messages-above';
import type { ThreadListScrollState } from '../ThreadList';

const reply: Message = {
  id: 'reply',
  sender_id: 'alice',
  content: 'Following up',
  created_at: '2026-10-28T12:00:00Z',
  updated_at: '2026-10-28T12:00:00Z',
  parent: { type: 'channel', id: 'channel' },
  thread_id: 'old',
  mentions: [],
  attachments: [],
  reactions: [],
};

it('points at a reply that lands in a thread above the viewport until it has been seen', () => {
  createRoot((dispose) => {
    const [messages, setMessages] = createSignal<
      { id: string; thread: { preview: { id: string }[] } }[]
    >([
      { id: 'old', thread: { preview: [] } },
      { id: 'middle', thread: { preview: [] } },
      { id: 'latest', thread: { preview: [] } },
    ]);
    const atLatest: ThreadListScrollState = {
      didInitialScroll: true,
      isNearBottom: true,
      isScrollingDown: false,
      distanceFromTop: 2000,
      distanceFromBottom: 0,
      viewportSize: 400,
      visibleRange: { first: 'latest', last: 'latest' },
    };
    const [scrollState, setScrollState] = createSignal(atLatest);
    const container = document.createElement('div');
    const viewport = document.createElement('div');
    viewport.dataset.channelScroll = '';
    viewport.getBoundingClientRect = () => new DOMRect(0, 0, 500, 400);
    container.append(viewport);
    document.body.append(container);
    const messageElements = new Map<string, HTMLElement>();
    const newMessages = createNewMessagesAbove({
      channelId: 'channel',
      messages,
      keys: () => ['old', 'middle', 'latest'],
      scrollState,
      container: () => container,
      insets: () => ({ start: 0, end: 0 }),
      elements: { messages: messageElements, disclosures: new Map() },
    });

    // The sender's own reply to the oldest thread, through the cache insert
    // every send and live post goes through.
    insertMessageIntoTargetCaches(
      { type: 'channel', id: 'channel' },
      { kind: 'thread_reply', threadId: 'old', messageId: 'reply' },
      reply
    );
    insertMessageIntoTargetCaches(
      { type: 'channel', id: 'other-channel' },
      { kind: 'thread_reply', threadId: 'old', messageId: 'elsewhere' },
      { ...reply, id: 'elsewhere' }
    );
    setMessages([
      { id: 'old', thread: { preview: [{ id: 'reply' }] } },
      { id: 'middle', thread: { preview: [] } },
      { id: 'latest', thread: { preview: [] } },
    ]);
    newMessages.dismissSeen();
    expect(newMessages.chip()).toEqual({
      target: { threadId: 'old', messageId: 'reply' },
      count: 1,
    });

    // Following the chip mounts the reply inside the viewport.
    const replyElement = document.createElement('div');
    replyElement.getBoundingClientRect = () => new DOMRect(0, 100, 500, 60);
    viewport.append(replyElement);
    messageElements.set('reply', replyElement);
    setScrollState({
      ...atLatest,
      isNearBottom: false,
      distanceFromTop: 0,
      visibleRange: { first: 'old', last: 'middle' },
    });
    newMessages.dismissSeen();
    expect(newMessages.chip()).toBeUndefined();

    // Back at the latest message, the seen reply no longer counts.
    replyElement.remove();
    messageElements.delete('reply');
    setScrollState(atLatest);
    newMessages.dismissSeen();
    expect(newMessages.chip()).toBeUndefined();

    container.remove();
    dispose();
  });
});

it('ignores a reply that lands in a visible thread and one whose send rolled back', () => {
  createRoot((dispose) => {
    const [messages, setMessages] = createSignal<
      { id: string; thread: { preview: { id: string }[] } }[]
    >([
      { id: 'old', thread: { preview: [] } },
      { id: 'latest', thread: { preview: [] } },
    ]);
    const newMessages = createNewMessagesAbove({
      channelId: 'channel',
      messages,
      keys: () => ['old', 'latest'],
      scrollState: () => ({
        didInitialScroll: true,
        isNearBottom: true,
        isScrollingDown: false,
        distanceFromTop: 2000,
        distanceFromBottom: 0,
        viewportSize: 400,
        visibleRange: { first: 'latest', last: 'latest' },
      }),
      container: () => undefined,
      insets: () => ({ start: 0, end: 0 }),
      elements: { messages: new Map(), disclosures: new Map() },
    });

    insertMessageIntoTargetCaches(
      { type: 'channel', id: 'channel' },
      { kind: 'thread_reply', threadId: 'latest', messageId: 'visible-reply' },
      { ...reply, id: 'visible-reply', thread_id: 'latest' }
    );
    insertMessageIntoTargetCaches(
      { type: 'channel', id: 'channel' },
      { kind: 'thread_reply', threadId: 'old', messageId: 'failed-reply' },
      { ...reply, id: 'failed-reply' }
    );
    // The failed send was removed again; only the visible reply remains.
    setMessages([
      { id: 'old', thread: { preview: [] } },
      { id: 'latest', thread: { preview: [{ id: 'visible-reply' }] } },
    ]);
    expect(newMessages.chip()).toBeUndefined();

    dispose();
  });
});
