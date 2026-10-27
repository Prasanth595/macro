import { createUrqlInfiniteQuery, createUrqlQuery } from '@app/lib/urql-solid';
import { arrayEquals } from '@core/util/compareUtils';
import { fireAndForget } from '@core/util/fireAndForget';
import { Telemetry } from '@macro-inc/observability';
import type { OperationResult } from '@urql/core';
import {
  type Accessor,
  batch,
  createComputed,
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';
import { normalizedCacheResultMetadata } from '../../../graphql-cache/exchange/normalized-cache-exchange';
import { selectRecords } from '../../../graphql-cache/exchange/record-selection';
import {
  type GroupedSoupInput,
  GroupSoupDocument,
  type GroupSoupQuery,
  type GroupSoupQueryVariables,
  type SoupItemFieldsFragment,
  SoupItemFieldsFragmentDoc,
} from '../../../service-clients/service-storage/graphql/generated/graphql';
import {
  getGraphqlSoupCacheHost,
  getGraphqlSoupClient,
} from '../../../service-clients/service-storage/graphql-soup';
import { registerGroupedSoupContinuation } from '../grouped/graphql-operation-registry';
import { registerGraphqlSoupRevalidations } from './active-queries';
import { createCollectionCoverage } from './create-collection-coverage';
import { createPredicateQuery } from './create-predicate-query';
import {
  groupCompleteSoupSnapshot,
  mergeGroupedSoupBins,
  projectLocalGroupedSoup,
} from './grouped-local-projection';
import { createGroupedPageEvidence } from './grouped-page-evidence';
import { soupItemKey, soupReconciliationBaseline } from './reconciliation';

/** Paging capabilities; rows for all loaded groups are owned by the parent source. */
export type GroupedSoupPaging = {
  hasNextPage(key: string): boolean;
  isFetchingNextPage(key: string): boolean;
  error(key: string): Error | null;
  fetchNextPage(key: string): Promise<void>;
  resetToInitialPage(): void;
};

type Options = {
  enabled: boolean;
  networkPaused?: boolean;
  keepPreviousData?: boolean;
  collectionUserId?: string;
  onInitialResult(
    result: OperationResult<GroupSoupQuery, GroupSoupQueryVariables>
  ): void;
};

/** One owner for grouped server pages and their maintained local membership. */
export function createGroupedSoupLiveQuery(
  input: Accessor<GroupedSoupInput | undefined>,
  options: Accessor<Options>,
  now: Accessor<Date>
) {
  const [generation, setGeneration] = createSignal(0);
  let previousHost = getGraphqlSoupCacheHost();
  createEffect(
    on(getGraphqlSoupCacheHost, (host) => {
      if (host !== previousHost) setGeneration((value) => value + 1);
      previousHost = host;
      if (host)
        onCleanup(
          host.onCacheGenerationChanged(() =>
            setGeneration((value) => value + 1)
          )
        );
    })
  );
  const scope = () =>
    JSON.stringify([input(), generation(), options().collectionUserId]);
  const initialEvidence = createGroupedPageEvidence(scope);
  const [coveragePass, setCoveragePass] = createSignal(0);
  const coverageScope = () => JSON.stringify([scope(), coveragePass()]);
  const initialCoverageEvidence = createGroupedPageEvidence(coverageScope);
  let initialResultScope: string | undefined;
  let refreshContinuations = (_data: GroupSoupQuery) => {};
  const selection = selectRecords(SoupItemFieldsFragmentDoc);
  const complete = createPredicateQuery<SoupItemFieldsFragment>({
    host: getGraphqlSoupCacheHost,
    query: () => {
      const initial = input()?.initial;
      const userId = options().collectionUserId;
      if (
        !options().enabled ||
        !userId ||
        !initial ||
        !getGraphqlSoupCacheHost()?.liveQueries ||
        (initial.sortMethod !== 'CREATED_AT' &&
          initial.sortMethod !== 'UPDATED_AT')
      )
        return undefined;
      return {
        source: {
          filters: initial.filters ?? {},
          sortMethod: initial.sortMethod,
          sortDirection: 'DESC',
          // Collection reads exhaust membership; this is only the bounded IR page size.
          limit: 500,
          collection: { userId },
        },
        select: selection,
      };
    },
  });
  // Cache revisions also advance for unrelated queries. Group only when membership
  // or selected grouping fields change; record patches remain fine-grained stores.
  const groupingSnapshot = createMemo(complete.data, undefined, {
    equals: (previous, next) =>
      previous === next ||
      Boolean(
        previous &&
          next &&
          previous.keys === next.keys &&
          previous.records === next.records &&
          arrayEquals(previous.retainedKeys, next.retainedKeys)
      ),
  });
  const localData = createMemo((): GroupSoupQuery | undefined => {
    const initial = input()?.initial;
    const userId = options().collectionUserId;
    const snapshot = groupingSnapshot();
    if (!initial || !userId || !snapshot || complete.status() !== 'ready')
      return;
    const span = Telemetry.span(
      'graphql_cache.soup_grouped_complete_evaluation'
    );
    try {
      const bins = groupCompleteSoupSnapshot(snapshot, initial, now());
      span.setAttr('grouping.field', initial.groupBy.field);
      span.setAttr('grouping.item_count', snapshot.keys.length);
      span.setAttr('grouping.complete', bins !== undefined);
      if (bins === undefined) return;
      return { user: { id: userId, groupSoup: { bins } } };
    } finally {
      span.end();
    }
  });
  const coverage = createCollectionCoverage({
    host: getGraphqlSoupCacheHost,
    request: () => {
      const initial = input()?.initial;
      const userId = options().collectionUserId;
      if (!options().enabled || options().networkPaused || !initial || !userId)
        return;
      return { userId, scope: coverageScope(), filters: initial.filters ?? {} };
    },
  });
  const query = createUrqlQuery<
    GroupSoupQuery,
    GroupSoupQueryVariables,
    { inputKey: string; data: GroupSoupQuery }
  >(() => {
    const queryInput = input();
    const requestScope = scope();
    const requestCoverageScope = coverageScope();
    const queryOptions = options();
    const common = {
      query: GroupSoupDocument,
      client: getGraphqlSoupClient(),
      requestPolicy: queryOptions.networkPaused
        ? ('cache-only' as const)
        : ('cache-and-network' as const),
      keepPreviousData: queryOptions.keepPreviousData ?? false,
      onResult: (
        result: OperationResult<GroupSoupQuery, GroupSoupQueryVariables>
      ) => {
        if (scope() !== requestScope) return;
        if (result.data && !result.error && !result.hasNext) {
          const resultScope = JSON.stringify([
            requestScope,
            result.data.user.id,
          ]);
          // Auto-pagination can start during the query's first data emission,
          // before onResult runs. That first response has no old chain to refresh.
          if (
            initialResultScope === resultScope &&
            normalizedCacheResultMetadata(result)?.source === 'live-network'
          )
            refreshContinuations(result.data);
          initialResultScope = resultScope;
        }
        initialEvidence.accept(result, 0, requestScope);
        if (queryOptions.collectionUserId)
          initialCoverageEvidence.accept(result, 0, requestCoverageScope);
        queryOptions.onInitialResult(result);
      },
      select: (data: GroupSoupQuery) => ({
        inputKey: JSON.stringify(queryInput),
        data,
      }),
    };
    return queryOptions.enabled && queryInput && coverage.ready()
      ? { ...common, variables: { input: queryInput }, enabled: true }
      : { ...common, enabled: false as const };
  });
  createComputed(
    on(coverage.failed, (failed) => {
      // Restart with fresh network evidence, never republish pages from a fenced scan.
      if (failed) setCoveragePass((pass) => pass + 1);
    })
  );
  const currentInitial = () => {
    const initial = query.data;
    return initial?.inputKey === JSON.stringify(input()) &&
      (!options().collectionUserId ||
        initial.data.user.id === options().collectionUserId)
      ? initial?.data
      : undefined;
  };
  const continuationScope = () =>
    JSON.stringify([scope(), currentInitial()?.user.id]);

  const createContinuation = (
    key: string,
    cursor: string,
    initial: GroupedSoupInput,
    refresh = false
  ) =>
    createRoot((dispose) => {
      const requestScope = continuationScope();
      const evidence = createGroupedPageEvidence(continuationScope);
      const requestCoverageScope = coverageScope();
      const coverageEvidence = createGroupedPageEvidence(coverageScope);
      const [activated, setActivated] = createSignal(false);
      const continuationInput = (cursor: string): GroupedSoupInput => ({
        continuation: {
          cursor,
          groupKey: key,
          groupBy: (initial.initial ?? initial.continuation).groupBy,
        },
      });
      let settle = () => {};
      const settled = new Promise<void>((resolve) => {
        settle = resolve;
      });
      const continued = createUrqlInfiniteQuery<
        GroupSoupQuery,
        GroupSoupQueryVariables,
        string,
        { pages: Accessor<GroupSoupQuery[]>; pageParams: readonly string[] }
      >(() => ({
        query: GroupSoupDocument,
        client: getGraphqlSoupClient(),
        initialPageParam: cursor,
        variables: (cursor) => {
          const pageInput = continuationInput(cursor);
          registerGroupedSoupContinuation(initial, pageInput);
          return { input: pageInput };
        },
        enabled:
          activated() &&
          options().enabled &&
          continuationScope() === requestScope,
        requestPolicy: options().networkPaused
          ? 'cache-only'
          : refresh || options().collectionUserId
            ? 'network-only'
            : 'cache-first',
        keepPreviousData: false,
        getNextPageParam: (page) =>
          page.user.groupSoup.bins.find((bin) => bin.key === key)?.nextCursor ??
          undefined,
        onResult: (result, page) => {
          evidence.accept(result, page.pageIndex, requestScope);
          if (options().collectionUserId)
            coverageEvidence.accept(
              result,
              page.pageIndex,
              requestCoverageScope
            );
        },
        select: ({ pages, pageParams }) => ({ pages: () => pages, pageParams }),
      }));
      onCleanup(
        registerGraphqlSoupRevalidations(() =>
          continued.isEnabled
            ? [...new Set([cursor, ...(continued.data?.pageParams ?? [])])].map(
                (cursor) => ({
                  document: GroupSoupDocument,
                  variables: { input: continuationInput(cursor) },
                })
              )
            : []
        )
      );
      createComputed(() => {
        if (
          activated() &&
          (!continued.isEnabled ||
            (continued.isFetched && !continued.isFetching))
        )
          settle();
      });
      onCleanup(settle);
      return {
        query: continued,
        evidence,
        coverageEvidence,
        dispose,
        activate: async () => {
          setActivated(true);
          await settled;
        },
      };
    });
  const [continuations, setContinuations] = createSignal<
    ReadonlyMap<string, ReturnType<typeof createContinuation>>
  >(new Map());
  type Refresh = {
    continuation: ReturnType<typeof createContinuation>;
    done: Promise<void>;
  };
  const [refreshes, setRefreshes] = createSignal<ReadonlyMap<string, Refresh>>(
    new Map()
  );
  const [refreshErrors, setRefreshErrors] = createSignal<
    ReadonlyMap<string, Error>
  >(new Map());
  const cancelRefresh = (key: string) => {
    const refresh = refreshes().get(key);
    if (!refresh) return;
    setRefreshes((previous) => {
      const remaining = new Map(previous);
      remaining.delete(key);
      return remaining;
    });
    refresh.continuation.dispose();
  };
  const resetContinuations = () => {
    for (const key of refreshes().keys()) cancelRefresh(key);
    for (const continuation of continuations().values()) continuation.dispose();
    setContinuations(new Map());
    setRefreshErrors(new Map());
  };

  // Rebuild from the new cursor without exposing a partially loaded chain.
  // The previous owner remains live until every previously loaded page is ready.
  async function replaceContinuation(
    key: string,
    previous: ReturnType<typeof createContinuation>,
    refresh: Refresh
  ) {
    const replacement = refresh.continuation;
    const current = () =>
      refreshes().get(key) === refresh && continuations().get(key) === previous;
    const span = Telemetry.span('graphql_cache.soup_grouped_refresh');
    span.setAttr('grouping.refresh_outcome', 'cancelled');
    return span.run(async () => {
      try {
        // A load-more already in flight can extend the visible chain. Paging
        // is gated by refreshes while we wait, so its settled depth is final.
        if (!previous.query.isFetched) await previous.activate();
        if (previous.query.isFetchingNextPage)
          await previous.query.fetchNextPage();
        if (!current()) return;
        const pageCount = Math.max(1, previous.query.data?.pages().length ?? 0);
        span.setAttr('grouping.page_count', pageCount);
        await replacement.activate();
        if (!current()) return;
        if (replacement.query.error) throw replacement.query.error;
        for (let page = 1; page < pageCount; page += 1) {
          if (!replacement.query.hasNextPage) break;
          await replacement.query.fetchNextPage({ throwOnError: true });
          if (!current()) return;
        }
        if (!replacement.query.data || !replacement.query.isEnabled) return;
        batch(() => {
          setContinuations((owners) => new Map(owners).set(key, replacement));
          previous.dispose();
        });
        span.setAttr('grouping.refresh_outcome', 'replaced');
      } catch (cause) {
        if (!current()) return;
        const error = cause instanceof Error ? cause : new Error(String(cause));
        setRefreshErrors((errors) => new Map(errors).set(key, error));
        span.setAttr('grouping.refresh_outcome', 'failed');
        span.error(error.message);
        throw error;
      } finally {
        if (continuations().get(key) !== replacement) replacement.dispose();
        if (refreshes().get(key) === refresh) {
          setRefreshes((previous) => {
            const remaining = new Map(previous);
            remaining.delete(key);
            return remaining;
          });
        }
        span.end();
      }
    });
  }
  refreshContinuations = (data) => {
    const initial = input();
    if (!initial || !options().enabled || options().networkPaused) return;
    setRefreshErrors(new Map());
    for (const [key, previous] of continuations()) {
      cancelRefresh(key);
      const cursor = data.user.groupSoup.bins.find(
        (bin) => bin.key === key
      )?.nextCursor;
      if (!cursor) {
        setContinuations((owners) => {
          const remaining = new Map(owners);
          remaining.delete(key);
          return remaining;
        });
        previous.dispose();
        continue;
      }
      const refresh = {
        continuation: createContinuation(key, cursor, initial, true),
        done: Promise.resolve(),
      };
      setRefreshes((previous) => new Map(previous).set(key, refresh));
      refresh.done = replaceContinuation(key, previous, refresh);
      fireAndForget(refresh.done, 'soup-grouped-refresh');
    }
  };
  createComputed(on(continuationScope, () => resetContinuations()));
  createComputed(
    on(
      () => currentInitial()?.user.groupSoup.bins.map((bin) => bin.key) ?? [],
      (keys) => {
        const active = new Set(keys);
        const remaining = new Map(continuations());
        for (const [key, continuation] of remaining) {
          if (active.has(key)) continue;
          cancelRefresh(key);
          continuation.dispose();
          remaining.delete(key);
        }
        if (remaining.size !== continuations().size)
          setContinuations(remaining);
      }
    )
  );
  onCleanup(resetContinuations);

  const serverPages = createMemo(() => {
    const initial = currentInitial();
    if (!initial) return [];
    return [
      initial,
      ...[...continuations().values()].flatMap(
        (continuation) => continuation.query.data?.pages() ?? []
      ),
    ].filter((page) => page.user.id === initial.user.id);
  });
  const baseline = createMemo(() => {
    const initial = initialEvidence.data();
    if (
      !initial ||
      !currentInitial() ||
      initial[0].user.id !== currentInitial()?.user.id
    )
      return undefined;
    const pages = [...initial];
    const untrustedKeys = initialEvidence.untrustedKeys();
    for (const continuation of continuations().values()) {
      const loaded = continuation.query.data?.pages();
      if (!loaded?.length) continue;
      const evidence = continuation.evidence.data();
      if (!evidence || evidence.length !== loaded.length) return undefined;
      pages.push(...evidence);
      for (const key of continuation.evidence.untrustedKeys())
        untrustedKeys.add(key);
    }
    return {
      bins: mergeGroupedSoupBins(
        pages.filter((page) => page.user.id === initial[0].user.id)
      ),
      untrustedKeys,
    };
  });
  const coveragePages = createMemo(() => {
    if (refreshes().size || !options().collectionUserId) return;
    const initial = initialCoverageEvidence.networkData();
    if (
      !initial ||
      !currentInitial() ||
      initial[0].user.id !== options().collectionUserId
    )
      return;
    const pages = [...initial];
    for (const bin of initial[0].user.groupSoup.bins) {
      const continuation = continuations().get(bin.key);
      if (!continuation) {
        if (bin.nextCursor) return;
        continue;
      }
      const loaded = continuation.query.data?.pages();
      const evidence = continuation.coverageEvidence.networkData();
      if (
        !loaded ||
        !evidence ||
        evidence.length !== loaded.length ||
        continuation.query.hasNextPage ||
        continuation.query.isFetching ||
        continuation.query.error
      )
        return;
      pages.push(...evidence);
    }
    if (pages.some((page) => page.user.id !== options().collectionUserId))
      return;
    for (const bin of initial[0].user.groupSoup.bins) {
      const members = new Set(
        pages.flatMap((page) =>
          page.user.groupSoup.bins
            .filter((candidate) => candidate.key === bin.key)
            .flatMap((candidate) => candidate.items.map(soupItemKey))
        )
      );
      if (members.size !== bin.totalCount) return;
    }
    return pages;
  });
  createComputed(
    on([coveragePages, coverage.ready], ([pages, ready]) => {
      if (!pages || !ready) return;
      fireAndForget(
        coverage.finish(
          pages.flatMap((page) =>
            page.user.groupSoup.bins.flatMap((bin) =>
              bin.items.map(soupItemKey)
            )
          )
        ),
        'soup-grouped-coverage'
      );
    })
  );
  const live = createPredicateQuery<SoupItemFieldsFragment>({
    host: getGraphqlSoupCacheHost,
    query: () => {
      const initial = input()?.initial;
      const bins = baseline();
      if (
        !options().enabled ||
        localData() !== undefined ||
        !getGraphqlSoupCacheHost()?.liveQueries ||
        !initial ||
        !bins ||
        (initial.sortMethod !== 'CREATED_AT' &&
          initial.sortMethod !== 'UPDATED_AT')
      )
        return undefined;
      const membership = soupReconciliationBaseline(
        bins.bins.flatMap((bin) => bin.items),
        initial.sortMethod
      );
      if (!membership) return undefined;
      return {
        source: {
          filters: initial.filters ?? {},
          sortMethod: initial.sortMethod,
          sortDirection: 'DESC',
          limit: initial.limit ?? 20,
          baseline: membership,
        },
        select: selection,
      };
    },
  });
  const bins = createMemo(() => {
    const initial = input()?.initial;
    const evidence = baseline();
    const snapshot = live.data();
    if (!initial || !evidence || !snapshot || live.status() !== 'ready')
      return mergeGroupedSoupBins(serverPages());
    const span = Telemetry.span('graphql_cache.soup_grouped_local_evaluation');
    try {
      const currentItems = new Map<string, SoupItemFieldsFragment>();
      for (const page of serverPages())
        for (const bin of page.user.groupSoup.bins)
          for (const item of bin.items)
            currentItems.set(soupItemKey(item), item);
      const result = projectLocalGroupedSoup(
        evidence.bins,
        currentItems,
        snapshot,
        initial,
        now(),
        evidence.untrustedKeys
      );
      span.setAttr('grouping.field', initial.groupBy.field);
      span.setAttr('grouping.bin_count', result.length);
      span.setAttr(
        'grouping.baseline_count',
        evidence.bins.reduce((count, bin) => count + bin.items.length, 0)
      );
      return result;
    } finally {
      span.end();
    }
  });
  const paging: GroupedSoupPaging = {
    hasNextPage: (key) => {
      const continuation = continuations().get(key);
      return continuation?.query.data
        ? continuation.query.hasNextPage
        : Boolean(bins().find((bin) => bin.key === key)?.nextCursor);
    },
    isFetchingNextPage: (key) =>
      refreshes().has(key) ||
      (continuations().get(key)?.query.isFetching ?? false),
    error: (key) =>
      refreshErrors().get(key) ?? continuations().get(key)?.query.error ?? null,
    fetchNextPage: async (key) => {
      const initial = input();
      if (!initial || !options().enabled) return;
      const refresh = refreshes().get(key);
      if (refresh) {
        await refresh.done;
        return;
      }
      const current = continuations().get(key);
      if (current) {
        if (current.query.isFetching) return;
        if (!current.query.data) await current.query.refetch();
        else await current.query.fetchNextPage();
        return;
      }
      const cursor = bins().find((bin) => bin.key === key)?.nextCursor;
      if (!cursor) return;
      const continuation = createContinuation(key, cursor, initial);
      setContinuations((previous) => new Map(previous).set(key, continuation));
      await continuation.activate();
    },
    resetToInitialPage: () => resetContinuations(),
  };
  return {
    query,
    paging,
    isLocal: () => localData() !== undefined,
    isLoading: () =>
      options().enabled &&
      !localData() &&
      (!coverage.ready() || query.isLoading),
    isFetching: () => !localData() && query.isFetching,
    refresh: async () => {
      if (options().collectionUserId) {
        await getGraphqlSoupCacheHost()?.collectionCoverage?.({
          kind: 'invalidate',
        });
        complete.refresh();
        setCoveragePass((pass) => pass + 1);
        await coverage.waitUntilReady();
      }
      const requestScope = continuationScope();
      await query.refetch({
        requestPolicy: 'network-only',
        throwOnError: true,
      });
      while (continuationScope() === requestScope && refreshes().size) {
        await Promise.all(
          [...refreshes().values()].map((refresh) => refresh.done)
        );
      }
      if (continuationScope() !== requestScope) return;
      const error = refreshErrors().values().next().value;
      if (error) throw error;
    },
    data: createMemo((): GroupSoupQuery | undefined => {
      const local = localData();
      if (local) return local;
      const initial = currentInitial();
      if (!initial) {
        const previous = query.data?.data;
        return !options().collectionUserId ||
          previous?.user.id === options().collectionUserId
          ? previous
          : undefined;
      }
      return {
        ...initial,
        user: {
          ...initial.user,
          groupSoup: { ...initial.user.groupSoup, bins: bins() },
        },
      };
    }),
  };
}
