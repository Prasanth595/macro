import { useSplitPanelOrThrow } from '@components/app/split-layout/layoutUtils';
import { type Accessor, createMemo, onCleanup, untrack } from 'solid-js';
import type { EntitySearchCategory } from '../queries/entity-search';

type SearchResultWindow<T> = {
  query: string;
  category: EntitySearchCategory;
  items: T[];
};

/** Keep the loaded window visible while its source refreshes or rebuilds pages. */
export function createSearchResultWindow<T>(options: {
  key: string;
  query: Accessor<string>;
  category: Accessor<EntitySearchCategory>;
  items: Accessor<T[]>;
  pending: Accessor<boolean>;
  discard: Accessor<boolean>;
  hasMore: Accessor<boolean>;
}) {
  const { handle } = useSplitPanelOrThrow();
  const stored = untrack(() => handle.currentEntryState()?.[options.key]) as
    | SearchResultWindow<T>
    | undefined;
  const window = createMemo<SearchResultWindow<T>>(
    (previous) => {
      const query = options.query();
      const category = options.category();
      const items = options.items();
      if (options.discard()) return { query, category, items };
      if (
        previous?.query === query &&
        previous.category === category &&
        previous.items.length > 0 &&
        (options.pending() ||
          (items.length < previous.items.length && options.hasMore()))
      )
        return previous;
      return { query, category, items };
    },
    stored ?? {
      query: untrack(options.query),
      category: untrack(options.category),
      items: [],
    }
  );
  onCleanup(handle.registerEntryStateCaptor(options.key, window));
  return {
    items: () => window().items,
    needsMore: () =>
      !options.pending() &&
      !options.discard() &&
      options.hasMore() &&
      options.items().length < window().items.length,
  };
}
