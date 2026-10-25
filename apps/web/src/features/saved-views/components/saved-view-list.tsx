import { CollapsibleSection, ViewSidebar } from '@app/components/view-shell';
import {
  ContextMenuContent,
  ContextMenuTrigger,
} from '@core/component/ContextMenu';
import { ContextMenu } from '@kobalte/core/context-menu';
import BookmarkIcon from '@phosphor/bookmark-simple.svg';
import DotsIcon from '@phosphor/dots-three.svg';
import PlusIcon from '@phosphor/plus.svg';
import UsersIcon from '@phosphor/users.svg';
import { Button, Dropdown } from '@ui';
import { createSignal, For, type JSX, onCleanup, Show } from 'solid-js';
import type { SavedView } from '../core/saved-view';

export function SavedViewList(props: {
  items: readonly SavedView[] | undefined;
  loading: boolean;
  failed: boolean;
  open: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
  row: (view: SavedView) => JSX.Element;
}) {
  return (
    <CollapsibleSection.Root
      open={props.open}
      onOpenChange={props.onOpenChange}
    >
      <CollapsibleSection.Header>
        <CollapsibleSection.Trigger>
          <span class="min-w-0 truncate">Saved views</span>
          <CollapsibleSection.Indicator />
        </CollapsibleSection.Trigger>
        <CollapsibleSection.Action
          label="New saved view"
          onClick={props.onCreate}
        >
          <PlusIcon class="size-3.5" />
        </CollapsibleSection.Action>
      </CollapsibleSection.Header>
      <CollapsibleSection.Content>
        <ViewSidebar.Nav aria-label="Saved task views">
          <For each={props.items}>{props.row}</For>
        </ViewSidebar.Nav>
        <Show when={props.loading && !props.items}>
          <p class="px-3 py-2 text-xs text-ink-muted" role="status">
            Loading views…
          </p>
        </Show>
        <Show when={!props.loading && props.items?.length === 0}>
          <p class="px-3 py-2 text-xs text-ink-muted">
            Save a set of filters to return to it.
          </p>
        </Show>
        <Show when={props.failed}>
          <Button size="sm" variant="ghost" onClick={props.onRetry}>
            Retry loading views
          </Button>
        </Show>
        <Show when={props.hasMore}>
          <Button
            size="sm"
            variant="ghost"
            disabled={props.loadingMore}
            onClick={props.onLoadMore}
          >
            Load more views
          </Button>
        </Show>
      </CollapsibleSection.Content>
    </CollapsibleSection.Root>
  );
}

/** A row accepts its consumer's menus without owning CRUD or viewer state. */
export function SavedViewListRow(props: {
  view: SavedView;
  selected: boolean;
  onSelect: () => void;
  scopeKey: string | undefined;
  menu: (context: boolean, defer: (action: () => void) => void) => JSX.Element;
}) {
  const [menuAnchor, setMenuAnchor] = createSignal<HTMLElement>();
  let pending: { scopeKey: string | undefined; run: () => void } | undefined;
  let disposed = false;
  onCleanup(() => {
    disposed = true;
    pending = undefined;
  });
  const defer = (run: () => void) => {
    pending = { scopeKey: props.scopeKey, run };
  };
  const finishMenuClose = (event: Event) => {
    const action = pending;
    pending = undefined;
    if (!action) return;
    event.preventDefault();
    queueMicrotask(() => {
      if (disposed || action.scopeKey !== props.scopeKey) return;
      menuAnchor()
        ?.querySelector<HTMLElement>('button')
        ?.focus({ preventScroll: true });
      action.run();
    });
  };
  const label = () =>
    props.view.sharedTeamId
      ? `${props.view.name}, shared with team`
      : props.view.name;
  return (
    <ContextMenu>
      <ContextMenuTrigger
        as="div"
        ref={setMenuAnchor}
        class="group relative min-w-0"
      >
        <ViewSidebar.Item
          active={props.selected}
          onClick={props.onSelect}
          class="pr-10"
          title={label()}
          aria-label={label()}
        >
          <ViewSidebar.Icon>
            <BookmarkIcon class="size-4" />
          </ViewSidebar.Icon>
          <span class="truncate">{props.view.name}</span>
          <Show when={props.view.sharedTeamId}>
            <ViewSidebar.Trailing>
              <UsersIcon class="size-3.5" />
            </ViewSidebar.Trailing>
          </Show>
        </ViewSidebar.Item>
        <div class="absolute right-(--sidebar-action-inset) top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 touch:opacity-100">
          <Dropdown placement="bottom-end">
            <Dropdown.Trigger
              as={ViewSidebar.Control}
              label={`Actions for ${props.view.name}`}
            >
              <DotsIcon class="size-4" />
            </Dropdown.Trigger>
            <Dropdown.Content
              class="min-w-44"
              portalScope="local"
              onCloseAutoFocus={finishMenuClose}
            >
              {props.menu(false, defer)}
            </Dropdown.Content>
          </Dropdown>
        </div>
      </ContextMenuTrigger>
      <ContextMenu.Portal
        mount={menuAnchor()?.closest<HTMLElement>('.portal-scope') ?? undefined}
      >
        <ContextMenuContent class="min-w-44" onCloseAutoFocus={finishMenuClose}>
          {props.menu(true, defer)}
        </ContextMenuContent>
      </ContextMenu.Portal>
    </ContextMenu>
  );
}
