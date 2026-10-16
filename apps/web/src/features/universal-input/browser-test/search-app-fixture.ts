import { createSignal } from 'solid-js';

export const [openedSearchResult, setOpenedSearchResult] =
  createSignal<unknown>();
export function useSplitLayout() {
  return {
    openWithSplit: (content: unknown, options: unknown) => {
      setOpenedSearchResult({ content, options });
      return { status: 'opened' };
    },
  };
}
export function useCrmContactDiscovery() {
  return {
    contacts: () => [],
    isLoading: () => false,
    hasMore: () => false,
    isLoadingMore: () => false,
    loadMore: async () => {},
  };
}
export function useDatabaseDiscoverySync() {}

export function useAnalytics() {
  return { track: () => {} };
}
