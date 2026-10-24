import { CollapsibleSection, ViewSidebar } from '@app/components/view-shell';
import BookmarkIcon from '@phosphor/bookmark-simple.svg';
import PlusIcon from '@phosphor/plus.svg';
import UsersIcon from '@phosphor/users.svg';
import { Button } from '@ui';
import { For, Show } from 'solid-js';
import type { SavedView } from '../core/saved-view';

export function SavedViewList(props: {
  items: readonly SavedView[] | undefined;
  selectedId?: string;
  loading: boolean;
  failed: boolean;
  open: boolean;
  hasMore: boolean;
  loadingMore: boolean;
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
            {(view) => (
              <ViewSidebar.Item
                active={view.id === props.selectedId}
                onClick={() => props.onSelect(view.id)}
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
            )}
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
