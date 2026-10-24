import { createUrqlInfiniteQuery } from '@app/lib/urql-solid/create-urql-infinite-query';
import { fireAndForget } from '@core/util/fireAndForget';
import { createLiveQuery } from '@graphql-cache/solid/create-live-query';
import { Telemetry } from '@macro-inc/observability';
import {
  CreateSavedViewDocument,
  DeleteSavedViewDocument,
  SavedViewDocument,
  type SavedViewFieldsFragment,
  SavedViewsDocument,
  type SavedViewsQuery,
  type SavedViewsQueryVariables,
  UpdateSavedViewDocument,
} from '@service-storage/graphql/generated/graphql';
import type { Client, CombinedError } from '@urql/core';
import { err, ok, ResultAsync } from 'neverthrow';
import {
  type Accessor,
  createEffect,
  createMemo,
  on,
  onCleanup,
  onMount,
} from 'solid-js';
import type { SavedViewsSource } from '../context/saved-views-source';
import type { SavedView, SavedViewError } from '../core/saved-view';

function toSavedView(view: SavedViewFieldsFragment): SavedView {
  return {
    id: view.id,
    ownerId: view.ownerId,
    name: view.name,
    config: view.config,
    sharedTeamId: view.sharedTeamId ?? null,
    revision: view.revision,
  };
}

function transportError(error: unknown): SavedViewError {
  return {
    code: 'UNAVAILABLE',
    message:
      error instanceof Error
        ? error.message
        : 'The saved view could not be saved. Try again.',
  };
}

function responseError(error: CombinedError): SavedViewError {
  const code = error.graphQLErrors[0]?.extensions.code;
  return {
    code: typeof code === 'string' ? code : 'UNAVAILABLE',
    message:
      error.graphQLErrors[0]?.message ??
      'Saved views are unavailable. Try again.',
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
  // Rebuild the loaded cursor chain, rather than inserting an edge into a full page.
  // Cache normalization handles record fields; the server owns collection membership.
  const reconcileMembership = (writer: Client) => {
    if (writer === client()) fireAndForget(refresh(), 'saved-views');
  };
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
    async create(input) {
      const writer = client();
      return Telemetry.span('saved_view.create', async (span) => {
        span.setAttr('saved_view.id', input.id);
        const result = await ResultAsync.fromPromise(
          writer.mutation(CreateSavedViewDocument, { input }).toPromise(),
          transportError
        );
        if (result.isErr()) {
          span.error('Saved view create failed');
          return err(result.error);
        }
        if (result.value.error) {
          span.error('Saved view create rejected');
          return err(responseError(result.value.error));
        }
        const view = result.value.data?.createSavedView;
        if (!view)
          return err({
            code: 'UNAVAILABLE',
            message: 'The server did not return the saved view.',
          });
        reconcileMembership(writer);
        return ok(toSavedView(view));
      });
    },
    async update(input) {
      const writer = client();
      return Telemetry.span('saved_view.update', async (span) => {
        span.setAttr('saved_view.id', input.id);
        const result = await ResultAsync.fromPromise(
          writer
            .mutation(UpdateSavedViewDocument, {
              input: {
                id: input.id,
                expectedRevision: input.expectedRevision,
                name: input.name,
                config: input.config,
                sharing:
                  input.sharedTeamId === undefined
                    ? undefined
                    : { teamId: input.sharedTeamId },
              },
            })
            .toPromise(),
          transportError
        );
        if (result.isErr()) {
          span.error('Saved view update failed');
          return err(result.error);
        }
        if (result.value.error) {
          span.error('Saved view update rejected');
          return err(responseError(result.value.error));
        }
        const view = result.value.data?.updateSavedView;
        if (!view)
          return err({
            code: 'UNAVAILABLE',
            message: 'The server did not return the saved view.',
          });
        reconcileMembership(writer);
        return ok(toSavedView(view));
      });
    },
    async delete(input) {
      const writer = client();
      return Telemetry.span('saved_view.delete', async (span) => {
        span.setAttr('saved_view.id', input.id);
        const result = await ResultAsync.fromPromise(
          writer.mutation(DeleteSavedViewDocument, { input }).toPromise(),
          transportError
        );
        if (result.isErr()) {
          span.error('Saved view delete failed');
          return err(result.error);
        }
        if (result.value.error) {
          span.error('Saved view delete rejected');
          return err(responseError(result.value.error));
        }
        if (!result.value.data)
          return err({
            code: 'UNAVAILABLE',
            message: 'The server did not confirm the deletion.',
          });
        reconcileMembership(writer);
        return ok(undefined);
      });
    },
  };
}
