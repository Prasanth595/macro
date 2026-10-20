import {
  useChannelDocumentAttachmentsQuery,
  useChannelMediaAttachmentsQuery,
} from '@queries/channel/channel-attachments';
import { cn } from '@ui';
import { type ParentProps, Show, Suspense } from 'solid-js';
import { ChannelAttachmentEntitySection } from './ChannelAttachmentEntitySection';
import { ChannelAttachmentMediaSection } from './ChannelAttachmentMediaSection';
import { FlatAttachmentSections } from './SectionHeader';

function CompactAttachments(props: ParentProps<{ channelId: string }>) {
  const media = useChannelMediaAttachmentsQuery(() => props.channelId);
  const documents = useChannelDocumentAttachmentsQuery(() => props.channelId);
  const empty = () =>
    media.isSuccess &&
    documents.isSuccess &&
    media.data.pages.every((page) => page.items.length === 0) &&
    documents.data.pages.every((page) => page.items.length === 0);
  return (
    <Show
      when={!empty()}
      fallback={<p class="pb-1 text-sm text-ink-muted">No attachments yet</p>}
    >
      <div class="flex h-80 min-h-0 flex-col gap-2 overflow-hidden">
        {props.children}
      </div>
    </Show>
  );
}

export function ChannelAttachmentsTab(props: {
  channelId: string;
  compact?: boolean;
}) {
  const sections = () => (
    <>
      <Suspense>
        <ChannelAttachmentMediaSection channelId={props.channelId} />
      </Suspense>
      <Suspense>
        <ChannelAttachmentEntitySection channelId={props.channelId} />
      </Suspense>
    </>
  );
  return (
    <div
      class={cn(
        'relative min-h-0 overflow-hidden flex justify-center',
        props.compact ? 'px-3 pb-3' : 'h-full flex-1 p-2'
      )}
      style={
        props.compact ? { '--attachment-content-padding': '0px' } : undefined
      }
    >
      <div
        class={cn(
          'macro-message-width w-full flex flex-col gap-2 overflow-hidden',
          !props.compact && 'h-full'
        )}
      >
        <FlatAttachmentSections.Provider value={props.compact ?? false}>
          <Show when={props.compact} fallback={sections()}>
            <CompactAttachments channelId={props.channelId}>
              {sections()}
            </CompactAttachments>
          </Show>
        </FlatAttachmentSections.Provider>
      </div>
    </div>
  );
}
