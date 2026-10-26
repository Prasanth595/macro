import { ListSkeleton } from '@app/components/view-shell/ListSkeleton';
import { ChannelInputContainer } from '@channel/Input/ChannelInputContainer';
import { ThreadRepliesBridgeRail } from '@channel/Thread/ThreadRepliesBridgeRail';
import { ThreadReplyRail } from '@channel/Thread/ThreadReplyRail';
import { ThreadRootRail } from '@channel/Thread/ThreadRootRail';
import { threadOffsetX } from '@channel/Thread/utils/thread-rail-geometry';
import { FloatRegionOrInline } from '@components/app/mobile/float-regions/FloatRegion';
import { ComposerSurface, cn } from '@ui';
import { For, Show } from 'solid-js';

type PlaceholderMessage = {
  /** Sender name width in px. */
  name: number;
  /** Content line widths, as a percentage of the message column. */
  lines: number[];
  reactions?: boolean;
  /** The sender's next messages, grouped under this one. */
  grouped?: number[][];
  /** One-line thread replies: sender name and line widths. */
  replies?: [name: number, line: number][];
};

/**
 * A conversation's newest messages, oldest first. Enough rows to fill a tall
 * pane; the list is bottom-anchored, so short panes clip the oldest.
 */
const ROWS: (PlaceholderMessage | 'date')[] = [
  { name: 92, lines: [66, 38] },
  { name: 120, lines: [88], grouped: [[45]] },
  { name: 104, lines: [74, 58], grouped: [[41]] },
  {
    name: 128,
    lines: [82],
    replies: [
      [76, 34],
      [92, 52],
    ],
  },
  'date',
  { name: 88, lines: [94, 87, 36], reactions: true },
  { name: 116, lines: [24], grouped: [[68, 49]] },
  { name: 96, lines: [61] },
];

function Lines(props: { widths: number[] }) {
  return (
    <For each={props.widths}>
      {(width) => (
        <div class="flex h-6 items-center">
          <div style={{ width: `${width}%` }}>
            <ListSkeleton.Bar />
          </div>
        </div>
      )}
    </For>
  );
}

/** `Message.Layout`'s grid: the avatar column, then header and content. */
function MessageRow(props: {
  name?: number;
  lines: number[];
  reactions?: boolean;
}) {
  return (
    <div
      class={cn(
        'w-full pr-2 pl-(--message-padding-x)',
        props.name !== undefined && 'pt-(--regular-message-padding-t)'
      )}
    >
      <div class="grid grid-cols-[var(--user-icon-width)_minmax(0,1fr)] items-start gap-x-2 gap-y-1">
        <Show when={props.name}>
          {(name) => (
            <>
              <ListSkeleton.Bar class="row-span-2 size-(--user-icon-width)" />
              <div class="flex h-5 items-center gap-2">
                <div style={{ width: `${name()}px` }}>
                  <ListSkeleton.Bar />
                </div>
                <ListSkeleton.Bar class="h-2 w-10" />
              </div>
            </>
          )}
        </Show>
        <div class="col-start-2 flex min-w-0 flex-col">
          <Lines widths={props.lines} />
          <Show when={props.reactions}>
            <div class="mt-0.5 mb-1 flex gap-1">
              <ListSkeleton.Bar class="h-7 w-12 rounded-lg" />
              <ListSkeleton.Bar class="h-7 w-10 rounded-lg" />
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

/** A message with its grouped follow-ups and thread replies. */
function MessageGroup(props: { message: PlaceholderMessage }) {
  const replies = () => props.message.replies ?? [];
  return (
    <>
      <div class="relative">
        <ThreadRootRail visible={replies().length > 0} />
        <MessageRow
          name={props.message.name}
          lines={props.message.lines}
          reactions={props.message.reactions}
        />
      </div>
      <For each={props.message.grouped}>
        {(lines) => <MessageRow lines={lines} />}
      </For>
      <Show when={replies().length > 0}>
        <div class="relative w-full">
          <ThreadRepliesBridgeRail />
          <div
            class="flex w-full flex-col py-(--thread-padding-y)"
            style={{ 'padding-left': threadOffsetX }}
          >
            <For each={replies()}>
              {([name, line], index) => (
                <div class="relative">
                  <ThreadReplyRail
                    terminal={index() === replies().length - 1}
                  />
                  <MessageRow name={name} lines={[line]} />
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </>
  );
}

/**
 * Placeholder rows shaped like the message list's: the same column, avatar,
 * line height, and thread rails, anchored to the bottom like the list opens.
 * `Channel` shows it above the live composer while the first page loads.
 */
export function ChannelMessagesLoading() {
  return (
    <div
      role="status"
      aria-label="Loading conversation"
      class="flex min-h-0 flex-1 flex-col justify-end overflow-hidden touch:pt-(--mobile-content-inset-top) touch:pb-(--mobile-content-inset-bottom)"
    >
      <span class="sr-only">Loading conversation</span>
      <div aria-hidden="true" class="flex w-full justify-center px-2">
        <div class="macro-message-width isolate">
          <For each={ROWS}>
            {(row) =>
              row === 'date' ? (
                <div class="flex h-14 items-center gap-2.5 px-2 mobile:h-16">
                  <span class="h-px grow bg-thread-rail" />
                  <ListSkeleton.Bar class="w-16" />
                  <span class="h-px grow bg-thread-rail" />
                </div>
              ) : (
                <MessageGroup message={row} />
              )
            }
          </For>
          {/* The newest row's typing indicator slot. */}
          <div class="h-7" />
        </div>
      </div>
    </div>
  );
}

/**
 * The messages tab before `Channel` mounts: the placeholder rows, and an
 * empty composer where the live one will mount.
 */
export function ChannelLoading() {
  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <ChannelMessagesLoading />
      <FloatRegionOrInline region="accessory">
        <ChannelInputContainer>
          {/* The empty composer's height: `CollapsedInput`'s, which the
              expanded composer matches. */}
          <div aria-hidden="true" class="macro-message-width">
            <ComposerSurface
              as="div"
              class="h-[48.75px] w-full touch:h-12.5 touch:rounded-full touch:island"
            />
          </div>
        </ChannelInputContainer>
      </FloatRegionOrInline>
    </div>
  );
}
