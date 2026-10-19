import { ChannelInput, type InputHandle } from '@channel/Input';
import { buildPostMessageSendPayload } from '@channel/Input/message-payload';
import { useMessageBotMentionUsers } from '@channel/use-channel-bot-mention-users';
import { StaticMarkdownContext } from '@core/component/LexicalMarkdown/component/core/StaticMarkdown';
import { useUserId } from '@core/context/user';
import { getDisplayName, tryMacroId } from '@core/user';
import { fireAndForget } from '@core/util/fireAndForget';
import { thrownResultErrorHasCode } from '@core/util/result';
import CaretDown from '@phosphor/caret-down.svg';
import CaretRight from '@phosphor/caret-right.svg';
import { useMessageLink } from '@queries/messages/document-messages';
import {
  newMessageId,
  useSendMessageMutation,
} from '@queries/messages/mutations';
import {
  buildMessageIndex,
  useMessageTimelineQuery,
} from '@queries/messages/timeline';
import type {
  MessageListItem,
  MessageParent,
  TimelineActivity,
} from '@service-storage/messages';
import { createSignal, For, Show } from 'solid-js';
import { MessageThread } from './MessageThread';
import type { MessageData } from './types';

/** The root composer, inline below the roots or floating on touch devices. */
export function EntityConversationComposer(props: {
  parent: MessageParent;
  collapsible?: boolean;
  /** Dismiss the keyboard after submitting from a floating mobile composer. */
  blurOnSend?: boolean;
}) {
  const send = useSendMessageMutation();
  const userId = useUserId();
  const bots = useMessageBotMentionUsers(() => props.parent);
  let input: InputHandle | undefined;
  return (
    <ChannelInput
      parent={props.parent}
      bots={bots}
      input={{ mode: 'channel', placeholder: 'Leave a comment...' }}
      autofocus={false}
      collapsible={props.collapsible}
      onReady={(handle) => (input = handle)}
      onSend={async (snapshot) => {
        const senderId = userId();
        if (!senderId) return;
        await send.mutateAsync({
          parent: props.parent,
          senderId,
          optimisticId: newMessageId(),
          ...buildPostMessageSendPayload({ snapshot }),
        });
        input?.clear();
        if (props.blurOnSend && document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
      }}
    />
  );
}

export function EntityConversation(props: {
  parent: MessageParent;
  canWrite: boolean;
  /** Delete comments the caller did not write. Document owners set this. */
  canModerate?: boolean;
  targetId?: string | null;
  /** The linked view stays around `targetId`, but its message is no longer highlighted. */
  targetCleared?: boolean;
  onClearTarget?: () => void;
  buildLink?: (message: MessageData) => string;
  label?: string;
  /** The composer is rendered elsewhere, such as a floating mobile accessory. */
  hideComposer?: boolean;
  /** Render nothing while there is no root to show. */
  hideWhenEmpty?: boolean;
  /**
   * A deal timeline keeps comments as comments and shows a stage, a close,
   * a reopen, or an owner change as a short line. Other discussions keep
   * their own activity lines.
   */
  timeline?: 'deal';
}) {
  const [expanded, setExpanded] = createSignal(true);
  const target = useMessageLink(
    () => props.parent,
    () => props.targetId
  );
  // A copied link may name a reply or an anchored root; the window is a root window.
  const query = useMessageTimelineQuery(
    () => props.parent,
    target.rootId,
    target.resolved
  );
  const unavailable = () =>
    ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND'].some(
      (code) =>
        thrownResultErrorHasCode(query.error, code) ||
        (code !== 'NOT_FOUND' && thrownResultErrorHasCode(target.error(), code))
    );
  // Until the link resolves, the shared latest page would flash before the window jumps.
  const rows = (): ConversationRow[] => {
    if (!target.resolved() || query.isPending || unavailable()) return [];
    return buildMessageIndex(query.data?.pages).entries.flatMap(
      (entry): ConversationRow[] => {
        if (entry.type === 'activity') {
          const line =
            props.timeline === 'deal'
              ? dealChangeLine(entry.activity)
              : propertyChange(entry.activity);
          return line ? [{ key: entry.id, kind: 'note', ...line }] : [];
        }
        const message = entry.message;
        // Only known unanchored roots belong in Discussion. Live roots have
        // undefined anchors until their thread metadata is fetched.
        if (message.state.deleted_at || message.state.anchor !== null)
          return [];
        return [{ key: entry.id, kind: 'message', message }];
      }
    );
  };
  return (
    <Show when={!props.hideWhenEmpty || rows().length > 0}>
      <section class="mt-3 pb-12" data-entity-conversation>
        <button
          type="button"
          class="flex items-center gap-1"
          onClick={() => setExpanded(!expanded())}
        >
          {expanded() ? (
            <CaretDown class="size-3" />
          ) : (
            <CaretRight class="size-3" />
          )}
          <span class="text-xs">{props.label ?? 'Discussion'}</span>
        </button>
        <Show when={expanded() || props.targetId}>
          <StaticMarkdownContext>
            <Show when={!target.resolved() || query.isPending}>
              <p class="text-xs text-ink-muted">Loading comments...</p>
            </Show>
            <Show when={query.isError || unavailable()}>
              <button
                onClick={() => {
                  fireAndForget(query.refetch(), 'entity-conversation');
                  if (props.targetId)
                    fireAndForget(target.refetch(), 'entity-conversation');
                }}
              >
                Could not load comments. Retry
              </button>
            </Show>
            <Show when={!unavailable() && query.hasNextPage}>
              <button
                class="text-xs"
                disabled={query.isFetching}
                onClick={() =>
                  fireAndForget(query.fetchNextPage(), 'entity-conversation')
                }
              >
                Load earlier comments
              </button>
            </Show>
            <For each={rows()}>
              {(row) => (
                <Show
                  when={row.kind === 'message' ? row : undefined}
                  fallback={
                    <Show when={row.kind === 'note' ? row : undefined} keyed>
                      {(note) => (
                        <Show
                          when={note.at}
                          fallback={
                            <p class="py-1 text-xs text-ink-muted">
                              {note.text}
                            </p>
                          }
                        >
                          {(at) => (
                            <DealChangeLine
                              at={at()}
                              text={note.text}
                              ownerId={note.ownerId}
                            />
                          )}
                        </Show>
                      )}
                    </Show>
                  }
                >
                  {(current) => (
                    <MessageThread
                      data={current().message}
                      canWrite={props.canWrite}
                      canModerate={props.canModerate}
                      targetId={
                        target.rootId() === current().message.id &&
                        !props.targetCleared
                          ? target.messageId()
                          : null
                      }
                      onClearTarget={props.onClearTarget}
                      buildLink={props.buildLink}
                    />
                  )}
                </Show>
              )}
            </For>
            <Show when={!unavailable() && query.hasPreviousPage}>
              <button
                class="text-xs"
                disabled={query.isFetching}
                onClick={() =>
                  fireAndForget(
                    query.fetchPreviousPage(),
                    'entity-conversation'
                  )
                }
              >
                Load newer comments
              </button>
            </Show>
            <Show
              when={props.canWrite && !props.hideComposer && !unavailable()}
            >
              <div class="mt-4">
                <EntityConversationComposer parent={props.parent} />
              </div>
            </Show>
          </StaticMarkdownContext>
        </Show>
      </section>
    </Show>
  );
}

type ConversationRow =
  | { key: string; kind: 'note'; text?: string; at?: string; ownerId?: string }
  | { key: string; kind: 'message'; message: MessageListItem };

function changedField(
  activity: TimelineActivity
): { property: string; to: unknown } | undefined {
  if (activity.action !== 'property_changed') return undefined;
  const payload = activity.payload;
  if (!payload || typeof payload !== 'object') return undefined;
  const property =
    'property' in payload && typeof payload.property === 'string'
      ? payload.property
      : undefined;
  if (!property) return undefined;
  return { property, to: 'to' in payload ? payload.to : undefined };
}

/** A field change on the same list as comments. Other activity stays out. */
function propertyChange(
  activity: TimelineActivity
): { text: string } | undefined {
  const change = changedField(activity);
  if (!change || change.property === 'When') return undefined;
  if (typeof change.to === 'string' && change.to.length > 0) {
    return { text: `${change.property} changed to ${change.to}` };
  }
  if (change.to == null) return { text: `${change.property} cleared` };
  return undefined;
}

/** Stage, close, reopen, and owner. The card already shows the rest. */
function dealChangeLine(
  activity: TimelineActivity
): { text?: string; at: string; ownerId?: string } | undefined {
  const change = changedField(activity);
  if (!change) return undefined;
  const at = activity.occurred_at;
  const value =
    typeof change.to === 'string' && change.to.length > 0
      ? change.to
      : undefined;
  if (change.property === 'Stage' && value) {
    return { at, text: `Stage changed to ${value}` };
  }
  if (change.property === 'Outcome' && value) {
    return { at, text: `Outcome changed to ${value}` };
  }
  if (change.property === 'Outcome' && change.to == null) {
    return { at, text: 'Reopened' };
  }
  if (change.property === 'Owner' && value) return { at, ownerId: value };
  if (change.property === 'Owner' && change.to == null) {
    return { at, text: 'Owner cleared' };
  }
  return undefined;
}

function ago(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function DealChangeLine(props: {
  at: string;
  text?: string;
  ownerId?: string;
}) {
  const text = () => {
    if (!props.ownerId) return props.text ?? '';
    const id = tryMacroId(props.ownerId);
    const name = id ? getDisplayName(id, { emailFallback: 'local-part' }) : '';
    return `Owner changed to ${name || 'someone'}`;
  };
  return (
    <p class="my-2 flex items-center gap-2 text-xs text-ink-muted">
      <span
        aria-hidden="true"
        class="size-2 shrink-0 rounded-full border-2 border-edge bg-surface"
      />
      <span class="min-w-0">
        {text()}
        <span class="text-ink-extra-muted"> · {ago(props.at)}</span>
      </span>
    </p>
  );
}
