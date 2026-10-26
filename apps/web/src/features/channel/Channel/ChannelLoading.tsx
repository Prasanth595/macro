/**
 * Blank pane while a conversation's messages or jump target resolve.
 * The header stays mounted. Assistive tech hears "Loading conversation";
 * the message area stays empty until the timeline arrives.
 */
export function ChannelLoading() {
  return (
    <div role="status" aria-label="Loading conversation" class="min-h-0 flex-1">
      <span class="sr-only">Loading conversation</span>
    </div>
  );
}
