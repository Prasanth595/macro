import {
  createListController,
  useListInteractions,
} from '@app/components/list';
import { ViewShell, ViewSidebar } from '@app/components/view-shell';
import { ListSkeleton } from '@app/components/view-shell/ListSkeleton';
import { useSplitPanelOrThrow } from '@components/app/split-layout/layoutUtils';
import { SplitPanel } from '@components/app/split-panel';
import { toast } from '@core/component/Toast/Toast';
import { registerHotkey } from '@core/hotkey/hotkeys';
import { TOKENS } from '@core/hotkey/tokens';
import { fireAndForget } from '@core/util/fireAndForget';
import { formatTimestamp } from '@entity/utils/timestamp';
import ArrowCounterClockwise from '@phosphor/arrow-counter-clockwise.svg';
import BellIcon from '@phosphor/bell.svg';
import { useMutationUndoContext } from '@queries/undo';
import { createElementSize } from '@solid-primitives/resize-observer';
import { Button, EmptyStatePanel } from '@ui';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  Match,
  onCleanup,
  onMount,
  Suspense,
  Switch,
} from 'solid-js';
import { Virtualizer, type VirtualizerHandle } from 'virtua/solid';
import { NotificationRow } from '../components/notification-row';
import {
  type NotificationInboxRow,
  useNotificationsInboxContext,
} from '../context/notifications-inbox-context';
import { describeInboxRow } from '../primitives/describe-row';
import { createInboxList } from '../primitives/inbox-list';

type ActivationMetadata = { event?: MouseEvent; newSplit?: boolean };

export type NotificationsViewProps = {
  /** Open what a row is about; the host decides where. */
  onOpen: (row: NotificationInboxRow, options: { newSplit: boolean }) => void;
};

/** Distance from the end of the list, in pixels, that loads the next page. */
const LOAD_MORE_DISTANCE_PX = 300;

function ListHeaderTitle() {
  return (
    <header class="flex shrink-0 flex-col">
      <ViewSidebar.Header>
        <div class="flex min-w-0 items-center gap-1">
          <ViewSidebar.CloseButton class="shrink-0" />
          <ViewSidebar.Title>Notifications</ViewSidebar.Title>
        </div>
      </ViewSidebar.Header>
    </header>
  );
}

function ListStatus(props: { children: JSX.Element }) {
  return (
    <div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-sm text-ink-muted">
      {props.children}
    </div>
  );
}

/**
 * The unified notifications list: one row per thing that needs the viewer,
 * newest first. `j`/`k` move, Enter opens, `e` marks the focused row done.
 */
export function NotificationsView(props: NotificationsViewProps) {
  const panel = useSplitPanelOrThrow();
  const context = useNotificationsInboxContext();
  const { pushUndo } = useMutationUndoContext();
  const feed = context.createFeed(() => ({ rowTypes: [] }));
  const inbox = createInboxList(feed, {
    pushUndo: (entry) => pushUndo(entry),
    announceDone: (count, undo) => {
      const id = toast.success(
        count > 1 ? `Marked ${count} notifications as done` : 'Marked as done',
        {
          actions: [
            {
              label: 'Undo',
              icon: ArrowCounterClockwise,
              onClick: () => fireAndForget(undo(), 'notifications-inbox'),
            },
          ],
          duration: 3_000,
          stack: true,
          hideOnMobile: true,
        }
      );
      return () => {
        if (id !== undefined) toast.dismiss(id);
      };
    },
    announceFailure: (message) => toast.failure(message),
  });

  onMount(() => panel.handle.setDisplayName('Notifications'));

  const view = createMemo(inbox.view);
  const rows = (): readonly NotificationInboxRow[] => {
    const current = view();
    return current.t === 'ready' ? current.rows : [];
  };

  const list = createListController<NotificationInboxRow, ActivationMetadata>({
    items: rows,
    getKey: (row) => row.id,
    onActivate: ({ item, metadata }) =>
      props.onOpen(item, {
        newSplit:
          metadata?.newSplit === true || metadata?.event?.shiftKey === true,
      }),
  });

  const [viewport, setViewport] = createSignal<HTMLDivElement>();
  const [virtualizer, setVirtualizer] = createSignal<VirtualizerHandle>();
  const viewportSize = createElementSize(viewport);

  const loadMore = () => fireAndForget(inbox.loadMore(), 'notifications-inbox');

  useListInteractions({
    controller: list,
    scopeId: panel.splitHotkeyScope,
    enabled: panel.isPanelActive,
    scrollHandle: virtualizer,
    navigation: {
      onNavigate: (event) => {
        if (event.kind !== 'move' || event.direction !== 1) return;
        if (!event.result || list.items.count() - event.result.index <= 4) {
          loadMore();
        }
      },
    },
    activation: {
      createMetadata: (intent) => ({ newSplit: intent === 'alternate' }),
      alternateDescription: 'Open in new split',
    },
  });

  registerHotkey({
    hotkey: ['e'],
    hotkeyToken: TOKENS.entity.action.markDone,
    scopeId: panel.splitHotkeyScope,
    description: 'Mark done',
    condition: () => panel.isPanelActive() && list.focus.item() !== undefined,
    keyDownHandler: (event) => {
      if (event?.repeat) return true;
      const row = list.focus.item();
      if (!row) return false;
      fireAndForget(inbox.markDone([row]), 'notifications-inbox');
      return true;
    },
  });

  // Keep paging while the loaded rows don't fill the viewport, including a
  // page whose rows all wait for the next one.
  const checkNearEnd = () => {
    const current = view();
    if (current.t !== 'ready' || !current.hasMore || current.loadingMore) {
      return;
    }
    const container = viewport();
    if (!container || container.clientHeight === 0) {
      if (current.rows.length === 0) loadMore();
      return;
    }
    const distance =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distance < LOAD_MORE_DISTANCE_PX) loadMore();
  };
  createEffect(() => {
    view();
    viewportSize.height;
    const frame = requestAnimationFrame(checkNearEnd);
    onCleanup(() => cancelAnimationFrame(frame));
  });

  const display = (row: NotificationInboxRow) =>
    describeInboxRow(row, context.actorName);

  const listBody = () => (
    <Switch>
      <Match when={view().t === 'loading'}>
        <ListSkeleton.Root
          label="Loading notifications"
          class="px-(--sidebar-gutter) pt-2"
        >
          <For each={[0, 1, 2, 3, 4]}>
            {() => (
              <ListSkeleton.Row class="h-16 flex-col items-start justify-center gap-2">
                <ListSkeleton.Bar class="w-1/2" />
                <ListSkeleton.Bar class="w-4/5" />
              </ListSkeleton.Row>
            )}
          </For>
        </ListSkeleton.Root>
      </Match>
      <Match when={view().t === 'error'}>
        <ListStatus>
          <span>Notifications couldn’t be loaded.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              fireAndForget(inbox.refresh(), 'notifications-inbox')
            }
          >
            Try again
          </Button>
        </ListStatus>
      </Match>
      <Match when={view().t === 'empty'}>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <EmptyStatePanel
            graphic={BellIcon}
            title="You’re all caught up"
            description="Mentions, replies, requests, and anything else that needs you will show up here."
          />
        </div>
      </Match>
      <Match when={view().t === 'ready'}>
        <div
          ref={setViewport}
          class="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-none"
          onScroll={checkNearEnd}
        >
          <Suspense>
            <Virtualizer
              ref={setVirtualizer}
              data={rows()}
              scrollRef={viewport()}
              bufferSize={500}
              itemSize={64}
              keepMounted={
                list.focus.index() >= 0 ? [list.focus.index()] : undefined
              }
              onScroll={checkNearEnd}
            >
              {(row) => (
                <NotificationRow
                  id={row.id}
                  type={row.type}
                  action={display(row).action}
                  subject={display(row).subject}
                  time={formatTimestamp(new Date(row.latestAt))}
                  count={row.count}
                  unseen={row.unseen}
                  highlighted={list.focus.key() === row.id}
                  onHover={() => list.focus.set(row.id, { reason: 'hover' })}
                  onClick={(event) =>
                    list.activate.key(row.id, {
                      reason: 'pointer',
                      metadata: { event },
                    })
                  }
                  onDone={() =>
                    fireAndForget(inbox.markDone([row]), 'notifications-inbox')
                  }
                />
              )}
            </Virtualizer>
          </Suspense>
        </div>
      </Match>
    </Switch>
  );

  return (
    <SplitPanel.Root>
      <SplitPanel.Body>
        <div class="size-full min-h-0 bg-panel">
          <ViewShell.Root
            asidePreferenceKey="notifications"
            aside={{ preserveDuringResize: false }}
            main={{ preferredWidth: 640 }}
            resizable
          >
            <ViewShell.Aside class="flex flex-col bg-panel">
              <ListHeaderTitle />
              <div
                role="grid"
                aria-label="Notifications"
                aria-activedescendant={list.focus.key()}
                tabIndex={0}
                class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none"
              >
                {listBody()}
              </div>
            </ViewShell.Aside>
            <ViewShell.Main class="overflow-hidden">
              <EmptyStatePanel
                graphic={BellIcon}
                title="No notification selected"
                description="Pick a notification to see it here."
              />
            </ViewShell.Main>
          </ViewShell.Root>
        </div>
      </SplitPanel.Body>
    </SplitPanel.Root>
  );
}
