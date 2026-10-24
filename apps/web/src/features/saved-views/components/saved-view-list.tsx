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
import { For, Show } from 'solid-js';
import type { SavedView } from '../core/saved-view';
import { SavedViewMenuItems } from './saved-view-menu';

export function SavedViewList(props: {
  items: readonly SavedView[] | undefined;
  selectedId?: string;
  loading: boolean;
  failed: boolean;
  open: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  viewerId?: string;
  canShare: boolean;
  saving?: boolean;
  onRename: (view: SavedView) => void;
  onShare: (view: SavedView) => void;
  onDuplicate: (view: SavedView) => void;
  onCopyLink: (view: SavedView) => void;
  onDelete: (view: SavedView) => void;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
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
          <For each={props.items}>
            {(view) => {
              const menuProps = {
                get owned() {
                  return view.ownerId === props.viewerId;
                },
                get canShare() {
                  return props.canShare || Boolean(view.sharedTeamId);
                },
                get disabled() {
                  return props.saving;
                },
                onRename: () => props.onRename(view),
                onShare: () => props.onShare(view),
                onDuplicate: () => props.onDuplicate(view),
                onCopyLink: () => props.onCopyLink(view),
                onDelete: () => props.onDelete(view),
              };
              return (
                <ContextMenu>
                  <ContextMenuTrigger as="div" class="group relative min-w-0">
                    <ViewSidebar.Item
                      active={view.id === props.selectedId}
                      onClick={() => props.onSelect(view.id)}
                      class="pr-10"
                      title={
                        view.sharedTeamId
                          ? `${view.name}, shared with team`
                          : view.name
                      }
                      aria-label={
                        view.sharedTeamId
                          ? `${view.name}, shared with team`
                          : view.name
                      }
                    >
                      <ViewSidebar.Icon>
                        <BookmarkIcon class="size-4" />
                      </ViewSidebar.Icon>
                      <span class="truncate">{view.name}</span>
                      <Show when={view.sharedTeamId}>
                        <ViewSidebar.Trailing>
                          <UsersIcon class="size-3.5" />
                        </ViewSidebar.Trailing>
                      </Show>
                    </ViewSidebar.Item>
                    <div class="absolute right-(--sidebar-action-inset) top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 touch:opacity-100">
                      <Dropdown placement="bottom-end">
                        <Dropdown.Trigger
                          as={ViewSidebar.Control}
                          label={`Actions for ${view.name}`}
                        >
                          <DotsIcon class="size-4" />
                        </Dropdown.Trigger>
                        <Dropdown.Content class="min-w-44">
                          <SavedViewMenuItems {...menuProps} />
                        </Dropdown.Content>
                      </Dropdown>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenu.Portal>
                    <ContextMenuContent class="min-w-44">
                      <SavedViewMenuItems context {...menuProps} />
                    </ContextMenuContent>
                  </ContextMenu.Portal>
                </ContextMenu>
              );
            }}
          </For>
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
