import { createUrqlInfiniteQuery } from '@app/lib/urql-solid/create-urql-infinite-query';
import { fireAndForget } from '@core/util/fireAndForget';
import { createLiveQuery } from '@graphql-cache/solid/create-live-query';
import {
  SavedViewDocument,
  type SavedViewFieldsFragment,
  SavedViewsDocument,
  type SavedViewsQuery,
  type SavedViewsQueryVariables,
} from '@service-storage/graphql/generated/graphql';
import type { Client } from '@urql/core';
import {
  type Accessor,
  createEffect,
  createMemo,
  on,
  onCleanup,
  onMount,
} from 'solid-js';
import type { SavedViewsSource } from '../context/saved-views-source';
import type { SavedView } from '../core/saved-view';

export function toSavedView(view: SavedViewFieldsFragment): SavedView {
  return {
    id: view.id,
    ownerId: view.ownerId,
    name: view.name,
    config: view.config,
    sharedTeamId: view.sharedTeamId ?? null,
    revision: view.revision,
  };
}

/** Shared GraphQL definitions, independent of the feature that interprets config. */
export function createSavedViewsSource(options: {
  graphql: Accessor<Client>;
  viewerId: Accessor<string | undefined>;
  selectedId: Accessor<string | undefined>;
  kind: string;
}): SavedViewsSource {
  const client = createMemo(options.graphql);
  const list = createUrqlInfiniteQuery<
    SavedViewsQuery,
    SavedViewsQueryVariables,
    string | null,
    { viewerId: string | undefined; items: SavedView[] }
  >(() => ({
    query: SavedViewsDocument,
    client: client(),
    enabled: Boolean(options.viewerId()),
    initialPageParam: null,
    variables: (cursor) => ({
      kind: options.kind,
      first: 50,
      after: cursor,
    }),
    getNextPageParam: (page) => page.user.savedViews.nextCursor ?? undefined,
    select: ({ pages }) => ({
      viewerId: pages[0]?.user.id,
      items: [
        ...new Map(
          pages
            .filter((page) => page.user.id === pages[0]?.user.id)
            .flatMap((page) =>
              page.user.savedViews.nodes.map(
                (view) => [view.id, toSavedView(view)] as const
              )
            )
        ).values(),
      ],
    }),
    keepPreviousData: false,
    requestPolicy: 'cache-and-network',
  }));
  const detail = createLiveQuery(
    SavedViewDocument,
    () => {
      const id = options.selectedId();
      return id && options.viewerId() ? { id } : undefined;
    },
    () => ({
      client: client(),
      requestPolicy: 'cache-and-network',
      keepPreviousData: false,
    })
  );
  const refresh = async () => {
    await list.refetch({ requestPolicy: 'network-only' });
  };
  const refreshDetail = async () => {
    if (options.selectedId())
      await detail.refetch({ requestPolicy: 'network-only' });
  };
  let lastViewer = options.viewerId();
  createEffect(
    on(options.viewerId, (viewer) => {
      if (!viewer) return;
      if (lastViewer && lastViewer !== viewer) {
        fireAndForget(refresh(), 'saved-views');
        fireAndForget(refreshDetail(), 'saved-views');
      }
      lastViewer = viewer;
    })
  );
  onMount(() => {
    const foreground = () => {
      if (document.visibilityState !== 'visible') return;
      fireAndForget(refresh(), 'saved-views');
      fireAndForget(refreshDetail(), 'saved-views');
    };
    window.addEventListener('focus', foreground);
    document.addEventListener('visibilitychange', foreground);
    onCleanup(() => {
      window.removeEventListener('focus', foreground);
      document.removeEventListener('visibilitychange', foreground);
    });
  });
  return {
    items: () =>
      list.data?.viewerId === options.viewerId() ? list.data?.items : undefined,
    loading: () => list.isPending || list.data?.viewerId !== options.viewerId(),
    error: () => list.error,
    hasMore: () => list.hasNextPage,
    loadingMore: () => list.isFetchingNextPage,
    loadMore: () => list.fetchNextPage(),
    refresh,
    detail: () =>
      detail.data?.user.id === options.viewerId()
        ? detail.data?.user.savedView
          ? toSavedView(detail.data.user.savedView)
          : null
        : undefined,
    detailViewerId: () => detail.data?.user.id,
    detailLoading: () =>
      detail.isPending || detail.data?.user.id !== options.viewerId(),
    detailError: () => detail.error,
    refreshDetail,
  };
}
