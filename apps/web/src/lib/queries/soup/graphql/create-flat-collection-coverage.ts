import { fireAndForget } from '@core/util/fireAndForget';
import { normalizedCacheResultMetadata } from '@graphql-cache/exchange/normalized-cache-exchange';
import type {
  ChannelListSoupQuery,
  SoupInitialInput,
  SoupQuery,
  SoupQueryVariables,
} from '@service-storage/graphql/generated/graphql';
import { getGraphqlSoupCacheHost } from '@service-storage/graphql-soup';
import type { OperationResult } from '@urql/core';
import {
  type Accessor,
  createComputed,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';
import { createCollectionCoverage } from './create-collection-coverage';
import { soupItemKey } from './reconciliation';

type Page = {
  scope: string;
  param: string | null;
  nextCursor: string | null;
  keys: string[];
  acknowledged: boolean;
};

/** Records a flat foreground scan without making bounded local candidates authoritative. */
export function createFlatCollectionCoverage(options: {
  input: Accessor<SoupInitialInput | undefined>;
  userId: Accessor<string | undefined>;
  enabled: Accessor<boolean>;
  scope: Accessor<string>;
}) {
  const [pass, setPass] = createSignal(0);
  const scope = () =>
    JSON.stringify([options.scope(), options.userId(), pass()]);
  const [pages, setPages] = createSignal<ReadonlyMap<number, Page>>(new Map());
  let active = true;
  onCleanup(() => {
    active = false;
  });
  const coverage = createCollectionCoverage({
    host: getGraphqlSoupCacheHost,
    request: () => {
      const userId = options.userId();
      const input = options.input();
      if (!options.enabled() || !userId || !input) return;
      return { userId, scope: scope(), filters: input.filters ?? {} };
    },
  });
  createComputed(
    on(coverage.failed, (failed) => {
      if (failed) setPass((value) => value + 1);
    })
  );
  const complete = createMemo(() => {
    if (!options.userId()) return;
    const current = [...pages()]
      .filter(([, page]) => page.scope === scope())
      .sort(([left], [right]) => left - right);
    if (!current.length) return;
    for (let index = 0; index < current.length; index += 1) {
      const [position, page] = current[index];
      if (position !== index || !page.acknowledged) return;
      if (index === 0 && page.param !== null) return;
      if (index > 0 && current[index - 1][1].nextCursor !== page.param) return;
      if (index < current.length - 1 && !page.nextCursor) return;
    }
    if (current.at(-1)?.[1].nextCursor !== null) return;
    return current.flatMap(([, page]) => page.keys);
  });
  createComputed(
    on([complete, coverage.ready], ([keys, ready]) => {
      if (keys && ready)
        fireAndForget(coverage.finish(keys), 'soup-flat-coverage');
    })
  );

  async function acknowledge(
    index: number,
    page: Page,
    persistence: Promise<unknown>
  ) {
    try {
      const revision = await persistence;
      if (
        revision === undefined ||
        !active ||
        scope() !== page.scope ||
        pages().get(index) !== page
      )
        return;
      setPages((previous) =>
        new Map(previous).set(index, { ...page, acknowledged: true })
      );
    } catch {
      // A failed write leaves the scan incomplete without hiding network rows.
    }
  }

  return {
    scope,
    ready: coverage.ready,
    restart: async () => {
      setPass((value) => value + 1);
      await coverage.waitUntilReady();
    },
    waitUntilReady: coverage.waitUntilReady,
    accept(
      result: OperationResult<
        SoupQuery | ChannelListSoupQuery,
        SoupQueryVariables
      >,
      pageInfo: { pageIndex: number; pageParam: string | null },
      requestScope: string
    ) {
      const metadata = normalizedCacheResultMetadata(result);
      const data = result.data;
      if (
        !active ||
        !options.userId() ||
        requestScope !== scope() ||
        result.error ||
        result.hasNext ||
        metadata?.source !== 'live-network' ||
        !data?.user.soup ||
        data.user.id !== options.userId()
      )
        return;
      const page: Page = {
        scope: requestScope,
        param: pageInfo.pageParam,
        nextCursor: data.user.soup.nextCursor ?? null,
        keys: data.user.soup.items.map(soupItemKey),
        acknowledged: metadata.revision !== undefined,
      };
      setPages((previous) => {
        const next =
          pageInfo.pageIndex === 0
            ? new Map<number, Page>()
            : new Map(previous);
        next.set(pageInfo.pageIndex, page);
        return next;
      });
      if (metadata.persistence)
        fireAndForget(
          acknowledge(pageInfo.pageIndex, page, metadata.persistence),
          'soup-flat-coverage'
        );
    },
  };
}
