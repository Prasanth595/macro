import type { EntityData } from '@entity';
import { keyArray } from '@solid-primitives/keyed';
import { type Accessor, createMemo } from 'solid-js';
import { useInstructionsMdIdQuery } from '../../../storage/instructions-md';
import { createKeyedProjection } from '../../create-keyed-projection';
import type { GroupedSoupPaging } from '../../graphql/create-grouped-soup-live-query';
import {
  usePendingGraphqlSoupDeleteIds,
  withoutPendingSoupEntities,
} from '../../graphql/optimistic-deletions';
import type {
  SoupApiItemFilter,
  SoupAstBody,
  SoupAstItemsGroupedPage,
  SoupParams,
} from '../../items';
import {
  isDisplayableSoupItem,
  isInstructionsMdDoc,
  mapApiSoupItemToEntity,
} from '../../transform-utils';
import type { GroupByField, GroupMeta } from '../types';
import { createGraphqlDirectoryGroupQueries } from './create-graphql-directory-group-queries';

export type GroupQueryData = { entities: EntityData[] };

type GraphqlGroupedInitialPage = {
  cachedMail?: boolean;
  items: SoupAstItemsGroupedPage['items'];
  groups: GroupMeta[];
};

type CreateGraphqlGroupedSoupQueriesArgs = {
  lazyGroupPagination?: Accessor<boolean>;
  networkPaused?: Accessor<boolean>;
  groupByField: Accessor<GroupByField | undefined>;
  soupParams: Accessor<SoupParams>;
  soupBody: Accessor<SoupAstBody>;
  initialPage: Accessor<GraphqlGroupedInitialPage | undefined>;
  groupedPaging?: Accessor<GroupedSoupPaging | undefined>;
  enabled: Accessor<boolean>;
  itemFilter: Accessor<SoupApiItemFilter | undefined>;
};

/** Group readers project the parent's combined pages; they never own a second cursor chain. */
function createGraphqlInitialGroupQueries(
  args: CreateGraphqlGroupedSoupQueriesArgs
) {
  const instructions = useInstructionsMdIdQuery();
  const pendingDeleteIds = usePendingGraphqlSoupDeleteIds();
  const rows = createKeyedProjection(
    () => Object.entries(args.initialPage()?.items ?? {}),
    ([id]) => id,
    ([id, item]) => {
      const filter = args.itemFilter();
      const entity =
        isDisplayableSoupItem(item) &&
        (!filter || filter(item)) &&
        !isInstructionsMdDoc(item, instructions)
          ? mapApiSoupItemToEntity(item)
          : undefined;
      return { id, entity };
    }
  );
  const byId = createMemo(
    () => new Map(rows().map((row) => [row.id, row.entity]))
  );
  const paging = () =>
    args.initialPage()?.cachedMail ? undefined : args.groupedPaging?.();
  const list = keyArray(
    () => args.initialPage()?.groups ?? [],
    (group) => group.key,
    (group) => ({
      key: group().key,
      data: createMemo(
        (): GroupQueryData => ({
          entities: withoutPendingSoupEntities(
            group().itemIds.flatMap((id) => {
              const entity = byId().get(id);
              return entity ? [entity] : [];
            }),
            pendingDeleteIds()
          ),
        })
      ),
      hasNextPage: () => paging()?.hasNextPage(group().key) ?? false,
      isFetchingNextPage: () =>
        paging()?.isFetchingNextPage(group().key) ?? false,
      error: () => paging()?.error(group().key) ?? null,
      fetchNextPage: async () => {
        if (args.enabled()) await paging()?.fetchNextPage(group().key);
      },
      resetToInitialPage: () => paging()?.resetToInitialPage(),
    })
  );
  return {
    list,
    map: createMemo(() => new Map(list().map((query) => [query.key, query]))),
    resetToInitialPage: () => paging()?.resetToInitialPage(),
  };
}

/** Initial pages and directories have different entity and cursor ownership. */
export function createGraphqlGroupedSoupQueries(
  args: CreateGraphqlGroupedSoupQueriesArgs
) {
  const lazy = () =>
    args.lazyGroupPagination?.() === true &&
    args.groupByField()?.type !== 'date';
  const initial = createGraphqlInitialGroupQueries({
    ...args,
    initialPage: () => (lazy() ? undefined : args.initialPage()),
  });
  const directory = createGraphqlDirectoryGroupQueries({
    ...args,
    initialPage: () => (lazy() ? args.initialPage() : undefined),
  });
  const active = () => (lazy() ? directory : initial);
  return {
    list: () => active().list(),
    map: () => active().map(),
    resetToInitialPage: () => {
      initial.resetToInitialPage();
      directory.resetToInitialPage();
    },
  };
}
