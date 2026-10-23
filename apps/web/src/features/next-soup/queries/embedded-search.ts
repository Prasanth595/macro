import { queryReadyGate } from '@queries/gate';
import { useSoupAstItemsQuery } from '@queries/soup/items';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';
import { createSearchState } from '../../soup/search';
import {
  type SearchFiltersState,
  searchNeedsKeywords,
} from '../core/search-filters';
import { compileSearchQuery } from '../core/search-query';
import { compileToAst, queryStateFrom } from '../filters/filter-store';
import { filterDataToQueryFilters } from './search-request';

/** The same global-search requests and filtered browsing, without split-view state. */
export function createEmbeddedSearchSource(options: {
  text: Accessor<string>;
  filters: Accessor<SearchFiltersState>;
  enabled: Accessor<boolean>;
}) {
  const needsKeywords = () =>
    searchNeedsKeywords(options.filters(), options.text());
  const enabled = () => options.enabled() && !needsKeywords();
  const query = createMemo(() =>
    queryStateFrom(compileSearchQuery(options.filters()))
  );
  const filtered = () =>
    options.filters().type !== 'all' || options.filters().tags.length > 0;
  const search = createSearchState({
    text: options.text,
    enabled,
    disableLocalSearch: filtered,
    buildRequest: ({ query: text, matchType }) => ({
      params: { page_size: 25 },
      body: {
        query: text,
        search_on: 'name_content',
        match_type: matchType,
        filters: filterDataToQueryFilters(query()),
      },
    }),
  });
  const browsing = () => options.text().trim().length === 0;
  const browse = useSoupAstItemsQuery(
    () => ({
      params: { limit: 25, sort_method: 'updated_at' },
      body: compileToAst(query()),
    }),
    () => ({
      enabled: enabled() && browsing(),
      keepPreviousData: false,
    })
  );
  return {
    needsKeywords,
    items: () =>
      !enabled()
        ? []
        : browsing()
          ? queryReadyGate(browse) && !browse.isPlaceholderData
            ? browse.data.entities
            : []
          : search.data(),
    loading: () =>
      enabled() &&
      (browsing() ? browse.isPending || browse.isFetching : search.isLoading()),
    error: () =>
      !enabled()
        ? undefined
        : browsing()
          ? browse.error?.message
          : search.error()?.message,
    hasMore: () =>
      enabled() && (browsing() ? browse.hasNextPage : search.hasNextPage()),
    loadingMore: () =>
      browsing() ? browse.isFetchingNextPage : search.isFetchingNextPage(),
    loadMore: async () => {
      if (browsing()) await browse.fetchNextPage();
      else await search.fetchNextPage();
    },
  };
}
