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
      fallback={
        <p class="py-10 text-center text-sm text-ink-muted">
          No attachments yet
        </p>
      }
    >
      {props.children}
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
        'relative flex-1 min-h-0 h-full overflow-hidden flex justify-center',
        props.compact ? 'px-4 pb-4' : 'p-2'
      )}
      style={
        props.compact ? { '--attachment-content-padding': '0px' } : undefined
      }
    >
      <div class="macro-message-width size-full flex flex-col gap-2 overflow-hidden">
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
