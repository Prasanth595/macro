import { DateGroupHeading } from '@app/features/next-soup/soup-view/date-group-heading';
import { dateBucket } from '@app/features/soup/collection/date-buckets';
import { formatLocale } from '@app/lib/i18n';
import { createKeyedProjection } from '@app/lib/queries/soup/create-keyed-projection';
import { fireAndForget } from '@core/util/fireAndForget';
import {
  type EntityData,
  ListEntity,
  ListEntityMetadataQueryProvider,
  ListLayoutProvider,
  type NarrowLayoutVariant,
} from '@entity';
import { Key } from '@solid-primitives/keyed';
import { Button } from '@ui';
import {
  createMemo,
  createSignal,
  For,
  type JSX,
  Match,
  Show,
  Switch,
} from 'solid-js';
import { useInfiniteScrollSentinel } from '../../../lib/primitives/infinite-scroll-sentinel';
import { useCrmContext } from '../context/crm-context';
import type { ItemListSource } from '../context/crm-sources';
import { recordItemMatchesSearch } from '../core/record-search';

/**
 * One of a CRM record's soup lists (emails, files, calls or references):
 * unified-list rows that open in a split, paging in as the end scrolls into
 * view. A failed request shows a retry instead of the empty state.
 */
export function RecordItemList(props: {
  source: ItemListSource;
  /** Hold the loading state, e.g. while the record itself loads. */
  pending?: boolean;
  empty: JSX.Element;
  search?: string;
  /** Row layout when the list is narrow, e.g. in the information panel. */
  narrowLayout?: NarrowLayoutVariant;
  groupItems?: (
    items: EntityData[]
  ) => { id: string; name: string; files: EntityData[] }[];
  rowActions?: (entity: EntityData) => JSX.Element;
  /** Property IDs to display as inline reference pills when needed. */
  referencePropertyIds?: readonly string[];
  /** Group the existing newest-first list by its last-updated date. */
  groupByDate?: boolean;
  /** Date field matching the list's server-side ordering. */
  dateField?: 'updated_at' | 'created_at' | 'viewed_at';
  /** Localized messages for a translated surface; existing tabs keep their copy. */
  messages?: {
    loading: string;
    loadFailed: string;
    searchingMore: string;
    noMatches: string;
    loadMoreFailed: string;
    loadingMore: string;
    retry: string;
  };
}) {
  const { openEntity } = useCrmContext().createNavigation();
  // Reading `data` before the first page resolves would suspend the tab.
  const items = () =>
    props.source.isPending ? [] : (props.source.data?.entities ?? []);
  const rows = createKeyedProjection(
    items,
    (item) => `${item.type}:${item.id}`,
    (item) => item
  );
  const filteredItems = createMemo(() =>
    rows().filter((item) => recordItemMatchesSearch(item, props.search ?? ''))
  );
  const groups = createMemo(
    () =>
      props.groupItems?.(filteredItems()) ?? [
        { id: 'all', name: '', files: filteredItems() },
      ]
  );
  const [listRef, setListRef] = createSignal<HTMLElement>();
  const [sentinelRef, setSentinelRef] = createSignal<HTMLDivElement>();

  useInfiniteScrollSentinel({
    sentinel: sentinelRef,
    hasNextPage: () =>
      (props.source.hasNextPage ?? false) && !props.source.isFetchNextPageError,
    isFetchingNextPage: () => props.source.isFetchingNextPage,
    fetchNextPage: () => props.source.fetchNextPage(),
  });

  // An enabled query is loading until its first page is readable, including
  // paused requests; a disabled one shows the empty state instead.
  const loading = () =>
    props.pending || (props.source.isPending && props.source.isEnabled);

  return (
    <Switch>
      <Match when={loading()}>
        <div class="p-6 text-center text-sm text-ink-muted">
          {props.messages?.loading ?? 'Loading…'}
        </div>
      </Match>
      <Match when={props.source.isError}>
        <RetryNotice
          message={props.messages?.loadFailed ?? "Couldn't load this list."}
          retryLabel={props.messages?.retry}
          onRetry={() => props.source.refetch()}
        />
      </Match>
      <Match when={items().length === 0 && !props.source.hasNextPage}>
        <div class="rounded-lg border border-dashed border-edge-muted p-6 text-center text-sm text-ink-muted">
          {props.empty}
        </div>
      </Match>
      <Match when={items().length > 0 || props.source.hasNextPage}>
        <ListEntityMetadataQueryProvider>
          <ListLayoutProvider ref={listRef} narrowLayout={props.narrowLayout}>
            <div ref={setListRef} class="flex flex-col">
              <Show when={filteredItems().length === 0}>
                <div class="p-6 text-center text-sm text-ink-muted">
                  {props.source.hasNextPage &&
                  !props.source.isFetchNextPageError
                    ? (props.messages?.searchingMore ?? 'Searching more…')
                    : (props.messages?.noMatches ?? 'No matching items.')}
                </div>
              </Show>
              <Key each={groups()} by="id">
                {(group) => {
                  const dateHeadings = createMemo(() => {
                    if (!props.groupByDate) return [];
                    const now = new Date();
                    let previous: string | undefined;
                    return group().files.map((entity) => {
                      const date =
                        props.dateField === 'created_at'
                          ? entity.createdAt
                          : props.dateField === 'viewed_at'
                            ? entity.viewedAt
                            : entity.updatedAt;
                      const bucket = dateBucket(date ?? entity.createdAt, now);
                      const label =
                        bucket.key !== previous ? bucket.label : undefined;
                      previous = bucket.key;
                      return label;
                    });
                  });
                  return (
                    <section aria-label={group().name || undefined}>
                      <Show when={group().name}>
                        <h3 class="flex items-center gap-2 px-3 pb-2 pt-4 text-sm font-medium">
                          {group().name}
                          <span class="text-xs text-ink-muted">
                            {group().files.length.toLocaleString(
                              formatLocale()
                            )}
                          </span>
                        </h3>
                      </Show>
                      <For each={group().files}>
                        {(entity, index) => (
                          <>
                            <Show when={dateHeadings()[index()]}>
                              {(label) => (
                                <DateGroupHeading
                                  label={label()}
                                  isFirst={index() === 0}
                                />
                              )}
                            </Show>
                            <div class="flex min-w-0 items-center gap-2 touch:flex-wrap">
                              <div class="min-w-0 flex-1">
                                <ListEntity
                                  entity={entity}
                                  hideCheckbox
                                  timestamp={entity.updatedAt}
                                  onClick={() => openEntity(entity)}
                                  referencePropertyIds={
                                    props.referencePropertyIds
                                  }
                                />
                              </div>
                              <Show when={props.rowActions}>
                                <div class="w-36 shrink-0 pr-2">
                                  {props.rowActions?.(entity)}
                                </div>
                              </Show>
                            </div>
                          </>
                        )}
                      </For>
                    </section>
                  );
                }}
              </Key>
            </div>
          </ListLayoutProvider>
        </ListEntityMetadataQueryProvider>
        <Show
          when={!props.source.isFetchNextPageError}
          fallback={
            <RetryNotice
              message={props.messages?.loadMoreFailed ?? "Couldn't load more."}
              retryLabel={props.messages?.retry}
              onRetry={() => props.source.fetchNextPage()}
            />
          }
        >
          <Show when={props.source.hasNextPage}>
            <div ref={setSentinelRef} class="h-px" />
          </Show>
          <Show when={props.source.isFetchingNextPage}>
            <div class="p-3 text-center text-xs text-ink-muted">
              {props.messages?.loadingMore ?? 'Loading more…'}
            </div>
          </Show>
        </Show>
      </Match>
    </Switch>
  );
}

/** A failed request, kept distinct from an empty list, with a retry. */
function RetryNotice(props: {
  message: string;
  retryLabel?: string;
  onRetry: () => Promise<unknown>;
}) {
  return (
    <div class="flex items-center justify-center gap-2 p-3 text-center text-xs text-ink-muted">
      <span>{props.message}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => fireAndForget(props.onRetry(), 'crm')}
      >
        {props.retryLabel ?? 'Retry'}
      </Button>
    </div>
  );
}
