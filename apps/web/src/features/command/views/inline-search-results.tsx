import { registerHotkey } from '@core/hotkey/hotkeys';
import { isEditableInput } from '@core/util/isEditableInput';
import { createCommandListController } from '@ui';
import { type Accessor, createEffect, createSignal, on } from 'solid-js';
import { defaultCommandResultIndex } from '../core/default-result-index';
import type { CommandMenuItem, PaginationControls } from '../useCommandItems';
import { CommandResults } from './command-results';

export type CommandSearchSource = {
  items: Accessor<CommandMenuItem[]>;
  isLoadingEntities: Accessor<boolean>;
  pagination: PaginationControls;
};

/** An embedded host keeps its editor focused while browsing the shared results. */
export function InlineSearchResults(props: {
  query: string;
  source: CommandSearchSource;
  onOpen: (item: CommandMenuItem, openInNewSplit: boolean) => void;
  scopeId: string;
  canHandleKeyboard?: Accessor<boolean>;
}) {
  const [navigating, setNavigating] = createSignal(false);
  const list = createCommandListController({ items: props.source.items });
  createEffect(
    on(
      () => props.query,
      () => {
        setNavigating(false);
        list.setSelectedIndex(0);
      }
    )
  );
  const acceptsEvent = (event?: KeyboardEvent) =>
    !!event &&
    !event.defaultPrevented &&
    !event.isComposing &&
    event.target instanceof Element &&
    !!isEditableInput(event.target);
  const options = {
    scopeId: props.scopeId,
    condition: () =>
      props.source.items().length > 0 && props.canHandleKeyboard?.() !== false,
    runWithInputFocused: true,
    hide: true,
  };
  const move = (direction: 1 | -1, event?: KeyboardEvent) => {
    if (!acceptsEvent(event)) return false;
    const items = props.source.items();
    if (!navigating()) {
      setNavigating(true);
      list.setSelectedIndex(
        direction === 1 ? defaultCommandResultIndex(items) : items.length - 1,
        { scrollIntoView: true }
      );
    } else if (direction === -1) list.selectPrevious();
    else if (
      list.selectedIndex() === items.length - 1 &&
      (props.source.pagination.hasMore() ||
        props.source.pagination.isLoadingMore())
    ) {
      if (!props.source.pagination.isLoadingMore())
        void props.source.pagination.loadMore();
    } else list.selectNext();
    return true;
  };
  const open = (openInNewSplit: boolean, event?: KeyboardEvent) => {
    if (!acceptsEvent(event) || !navigating()) return false;
    const selected = list.selectedItem();
    if (!selected) return false;
    props.onOpen(selected, openInNewSplit);
    return true;
  };
  registerHotkey({
    ...options,
    hotkey: 'arrowdown',
    description: 'Next search result',
    keyDownHandler: (event) => move(1, event),
  });
  registerHotkey({
    ...options,
    hotkey: 'arrowup',
    description: 'Previous search result',
    keyDownHandler: (event) => move(-1, event),
  });
  registerHotkey({
    ...options,
    hotkey: 'enter',
    description: 'Open search result',
    keyDownHandler: (event) => open(false, event),
  });
  registerHotkey({
    ...options,
    hotkey: 'shift+enter',
    description: 'Open in new split',
    keyDownHandler: (event) => open(true, event),
  });
  registerHotkey({
    ...options,
    hotkey: 'escape',
    description: 'Exit search navigation',
    keyDownHandler: (event) => {
      if (!acceptsEvent(event) || !navigating()) return false;
      setNavigating(false);
      return true;
    },
  });
  return (
    <CommandResults
      items={props.source.items()}
      loading={props.source.isLoadingEntities()}
      pagination={props.source.pagination}
      selectedIndex={navigating() ? list.selectedIndex() : -1}
      onSelect={props.onOpen}
      onItemMouseMove={(index) => {
        setNavigating(true);
        list.setSelectedIndexFromPointer(index);
      }}
      scrollSelectedIntoView={list.shouldScrollSelectedIntoView()}
    />
  );
}
