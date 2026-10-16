import { CommandMenuEmptyState } from '@ui';
import { createEffect, createSelector, Show } from 'solid-js';
import { type VirtualizerHandle, VList } from 'virtua/solid';
import { CommandItem } from '../CommandItem';
import type { CommandMenuItem, PaginationControls } from '../useCommandItems';

const VIRTUAL_ITEM_HEIGHT = 40;
const LIST_PADDING = 16;
const MAX_LIST_HEIGHT = VIRTUAL_ITEM_HEIGHT * 8 + LIST_PADDING;
const LOAD_MORE_THRESHOLD = VIRTUAL_ITEM_HEIGHT * 3;
const EMPTY_STATE_HEIGHT = VIRTUAL_ITEM_HEIGHT * 1.5 + LIST_PADDING;

type CommandResultsProps = {
  items: CommandMenuItem[];
  selectedIndex: number;
  onSelect: (item: CommandMenuItem, openInNewSplit: boolean) => void;
  onItemMouseMove: (index: number) => void;
  scrollSelectedIntoView: boolean;
  pagination?: PaginationControls;
  loading?: boolean;
  label?: string;
};

/** The same result rows, virtualization, and pagination in the menu and embedded search. */
export function CommandResults(props: CommandResultsProps) {
  const height = () =>
    props.items.length
      ? Math.min(
          MAX_LIST_HEIGHT,
          props.items.length * VIRTUAL_ITEM_HEIGHT + LIST_PADDING
        )
      : EMPTY_STATE_HEIGHT;
  return (
    <div
      role="listbox"
      aria-label={props.label ?? 'Search results'}
      aria-busy={props.loading || undefined}
      class="overflow-hidden transition-[height] duration-60 ease-out p-2"
      style={{ height: `${height()}px` }}
    >
      <Show
        when={props.items.length}
        fallback={
          <CommandMenuEmptyState>
            <span role="status">
              {props.loading ? 'Searching…' : 'No results found'}
            </span>
          </CommandMenuEmptyState>
        }
      >
        <VirtualizedCommandList {...props} />
      </Show>
    </div>
  );
}

/** Virtualized command list component */
function VirtualizedCommandList(props: {
  items: CommandMenuItem[];
  selectedIndex: number;
  onSelect: (item: CommandMenuItem, openInNewSplit: boolean) => void;
  onItemMouseMove: (index: number) => void;
  scrollSelectedIntoView: boolean;
  pagination?: PaginationControls;
}) {
  let virtualizerHandle: VirtualizerHandle | undefined;

  const loadMoreNearEnd = () => {
    const pagination = props.pagination;
    if (
      !virtualizerHandle ||
      !pagination?.hasMore() ||
      pagination.isLoadingMore()
    )
      return;
    const remaining =
      virtualizerHandle.scrollSize -
      virtualizerHandle.scrollOffset -
      virtualizerHandle.viewportSize;
    if (remaining <= LOAD_MORE_THRESHOLD) void pagination.loadMore();
  };

  createEffect(() => {
    const index = props.selectedIndex;
    if (
      !props.scrollSelectedIntoView ||
      index < 0 ||
      index >= props.items.length ||
      !virtualizerHandle
    ) {
      return;
    }
    // Skip when all items fit: scrolling would be a no-op at the final
    // container size, but during the height transition the container is
    // briefly clipped and scrollToIndex shifts scrollTop, hiding the search
    // row across category switches.
    if (props.items.length * VIRTUAL_ITEM_HEIGHT <= MAX_LIST_HEIGHT) {
      return;
    }
    virtualizerHandle.scrollToIndex(index, { align: 'nearest' });
  });

  const selector = createSelector(
    () => props.selectedIndex,
    (ndx, selected) => ndx === selected
  );

  return (
    <VList
      ref={(handle) => {
        virtualizerHandle = handle;
      }}
      data={props.items}
      style={{ height: '100%' }}
      class="scrollbar-hidden"
      onScroll={loadMoreNearEnd}
    >
      {(item, index) => (
        <CommandItem
          item={item}
          index={index()}
          selected={selector(index())}
          onSelect={props.onSelect}
          onMouseMove={props.onItemMouseMove}
        />
      )}
    </VList>
  );
}
