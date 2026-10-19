import { createEffect, createSignal, For, on, Show, Suspense } from 'solid-js';
import { v7 as newMessageId } from 'uuid';
import { CallChatPanel } from './components/CallChatPanel';
import { useGuestCallChat } from './queries/use-guest-call-chat';

type GuestCallChatProps = {
  callId: string;
  session: { token: string; participantId: string };
  id: string;
  open: boolean;
  onClose: () => void;
};

export default function GuestCallChat(props: GuestCallChatProps) {
  return (
    <Suspense>
      <GuestCallChatContent {...props} />
    </Suspense>
  );
}

function GuestCallChatContent(props: GuestCallChatProps) {
  const chat = useGuestCallChat(
    () => props.callId,
    () => props.session,
    () => props.open
  );
  const [content, setContent] = createSignal('');
  const [error, setError] = createSignal(false);
  let pending: { id: string; content: string } | undefined;
  let input!: HTMLTextAreaElement;
  createEffect(
    on([() => props.open, chat.ready], ([open, ready]) => {
      if (open && ready) input?.focus();
    })
  );

  async function send() {
    if (!content().trim() || !chat.ready() || chat.sending()) return;
    if (pending?.content !== content())
      pending = { id: newMessageId(), content: content() };
    setError(false);
    try {
      await chat.send(pending);
      pending = undefined;
      setContent('');
      void chat.refresh();
      input.focus();
    } catch {
      setError(true);
    }
  }

  return (
    <CallChatPanel
      {...props}
      composer={
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <Show when={error()}>
            <p role="alert" class="mb-2 text-sm text-failure">
              Message could not be sent. Try again.
            </p>
          </Show>
          <textarea
            ref={input}
            aria-label="Message this call"
            placeholder="Message this call…"
            class="w-full resize-none rounded-md bg-input p-2 text-sm text-ink placeholder:text-ink-placeholder"
            value={content()}
            disabled={!chat.ready() || chat.sending()}
            maxLength={16000}
            rows={3}
            onInput={(event) => setContent(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.isComposing
              ) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="submit"
            class="mt-2 rounded-md bg-accent px-3 py-1 text-sm text-surface disabled:opacity-50"
            disabled={!chat.ready() || chat.sending() || !content().trim()}
          >
            Send
          </button>
        </form>
      }
    >
      <Show when={chat.loading()}>
        <p role="status" class="text-sm text-ink-muted">
          Loading chat…
        </p>
      </Show>
      <Show when={chat.failed()}>
        <p role="alert" class="text-sm text-ink-muted">
          {chat.denied()
            ? 'Chat is available while you are in this call.'
            : 'Could not load chat.'}
        </p>
        <button
          type="button"
          class="text-sm text-accent"
          onClick={() => void chat.refresh()}
        >
          Retry
        </button>
      </Show>
      <Show when={chat.ready() && chat.messages().length === 0}>
        <p class="text-sm text-ink-muted">
          Start the conversation. Messages stay with this call.
        </p>
      </Show>
      <For each={chat.messages()}>
        {(message) => (
          <div class="mb-4">
            <p class="text-sm font-medium">
              {message.name}
              {message.guest ? ' (Guest)' : ''}
              {message.is_you ? ' · You' : ''}
            </p>
            <p class="whitespace-pre-wrap break-words text-sm">
              {message.content}
            </p>
          </div>
        )}
      </For>
    </CallChatPanel>
  );
}
