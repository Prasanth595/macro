import { useCrmContactDiscovery } from '@app/features/crm/record-adapter';
import { openEntityInSplitFromUnifiedList } from '@app/features/next-soup/utils';
import { projectRouteId } from '@app/features/projects/core/route';
import { useSplitLayout } from '@components/app/split-layout/layout';
import { useSplitPanelOrThrow } from '@components/app/split-layout/layoutUtils';
import { StaticMarkdownContext } from '@core/component/LexicalMarkdown/component/core/StaticMarkdown';
import { toast } from '@core/component/Toast/Toast';
import {
  type EntityData,
  ListEntity,
  ListEntityMetadataQueryProvider,
  ListLayoutProvider,
  type SearchLocation,
} from '@entity';
import { Telemetry } from '@macro-inc/observability';
import { useGetOrCreateDirectMessageMutation } from '@queries/channel/get-or-create-dm';
import { useDatabaseDiscoverySync } from '@queries/storage/databases';
import { Button, CommandMenuListItem } from '@ui';
import { createMemo, createSignal, For, Show, Suspense } from 'solid-js';
import { ItemDisplay } from '../CommandItem';
import {
  type EntitySearchItem,
  useEntitySearch,
} from '../queries/entity-search';
import { createMobileFullTextSearch } from '../queries/mobile-full-text-search';
import { SearchState } from './mobileSearchState';
import { useMobileSearchCategory } from './use-mobile-search-category';

function MobileNameResults() {
  const category = useMobileSearchCategory();
  const source = useEntitySearch(SearchState.query, category, {
    enabled: SearchState.isOpen,
    contactDiscovery: useCrmContactDiscovery,
  });
  useDatabaseDiscoverySync(SearchState.isOpen);
  const items = createMemo(() =>
    source.rankItems(source.items(), SearchState.query())
  );
  const { openWithSplit } = useSplitLayout();
  const panel = useSplitPanelOrThrow();
  const directMessage = useGetOrCreateDirectMessageMutation();
  const open = async (item: EntitySearchItem) => {
    await Telemetry.span('mobile.search.open', async (span) => {
      span.setAttr('entity.id', item.id);
      span.setAttr('entity.type', item.bucket);
      SearchState.close();
      if (item.kind === 'initiative') {
        openWithSplit({
          type: 'component',
          id: projectRouteId({ id: item.id, section: 'overview' }),
        });
      } else if (item.kind === 'user') {
        const result = await directMessage.mutateAsync({
          recipient_id: item.id,
        });
        openWithSplit(
          { type: 'channel', id: result.channel_id },
          { reopen: 'latest' }
        );
      } else {
        await openEntityInSplitFromUnifiedList(item.data, {
          splitHandle: panel.handle,
        });
      }
    });
  };
  const select = async (item: EntitySearchItem) => {
    try {
      await open(item);
    } catch {
      toast.failure('Unable to open result. Please try again.');
    }
  };
  return (
    <div class="h-full overflow-y-auto overscroll-none px-3 mobile:pt-(--mobile-content-inset-top) mobile:pb-(--mobile-content-inset-bottom)">
      <Show when={SearchState.query().trim() && category() !== 'projects'}>
        <div
          data-keep-keyboard
          onPointerDown={(event) => event.preventDefault()}
          onMouseDown={(event) => event.preventDefault()}
        >
          <CommandMenuListItem
            class="min-h-11"
            onClick={SearchState.searchFullText}
          >
            <span class="truncate">
              Search full text for “{SearchState.query().trim()}”
            </span>
          </CommandMenuListItem>
        </div>
      </Show>
      <For each={items()}>
        {(item) => (
          <CommandMenuListItem
            class="min-h-11"
            onClick={() => void select(item)}
          >
            <ItemDisplay item={item} />
          </CommandMenuListItem>
        )}
      </For>
      <Show when={source.isLoadingEntities()}>
        <p role="status" class="p-3 text-ink-muted">
          Loading…
        </p>
      </Show>
      <Show when={!source.isLoadingEntities() && items().length === 0}>
        <p class="p-3 text-ink-muted">No results</p>
      </Show>
      <Show when={source.pagination.hasMore()}>
        <Button
          disabled={source.pagination.isLoadingMore()}
          onClick={() => void source.pagination.loadMore()}
        >
          Load more
        </Button>
      </Show>
    </div>
  );
}

function MobileFullTextResults() {
  const category = useMobileSearchCategory();
  const search = createMobileFullTextSearch(SearchState.query, category);
  const panel = useSplitPanelOrThrow();
  const [container, setContainer] = createSignal<HTMLDivElement>();
  const open = async (entity: EntityData, location?: SearchLocation) => {
    try {
      await Telemetry.span('mobile.search.open', async (span) => {
        span.setAttr('entity.id', entity.id);
        span.setAttr('entity.type', entity.type);
        span.setAttr('search.content_hit', !!location);
        SearchState.close();
        await openEntityInSplitFromUnifiedList(entity, {
          splitHandle: panel.handle,
          location,
        });
      });
    } catch {
      toast.failure('Unable to open result. Please try again.');
    }
  };
  return (
    <div
      ref={setContainer}
      class="soup-list h-full overflow-y-auto overscroll-none mobile:pt-(--mobile-content-inset-top) mobile:pb-(--mobile-content-inset-bottom)"
    >
      <ListEntityMetadataQueryProvider>
        <ListLayoutProvider ref={container}>
          <StaticMarkdownContext>
            <For each={search.data()}>
              {(entity) => (
                <ListEntity
                  entity={entity}
                  hideCheckbox
                  hideContentHits={false}
                  onClick={() => void open(entity)}
                  onContentHitClick={(event, location) => {
                    event.stopPropagation();
                    void open(entity, location);
                  }}
                />
              )}
            </For>
          </StaticMarkdownContext>
        </ListLayoutProvider>
      </ListEntityMetadataQueryProvider>
      <Show when={search.isLoading()}>
        <p role="status" class="p-3 text-ink-muted">
          Searching…
        </p>
      </Show>
      <Show when={search.error()}>
        <p role="alert" class="p-3 text-ink-muted">
          Search failed. Please try again.
        </p>
        <Button onClick={() => void search.refetch()}>Retry</Button>
      </Show>
      <Show
        when={
          !search.isLoading() && !search.error() && search.data().length === 0
        }
      >
        <p class="p-3 text-ink-muted">No results</p>
      </Show>
      <Show when={search.hasNextPage()}>
        <Button
          disabled={search.isFetchingNextPage()}
          onClick={() => void search.fetchNextPage()}
        >
          Load more
        </Button>
      </Show>
    </div>
  );
}

/** The dock owns the input; only the result subtree changes search modes. */
export function MobileSearchResults() {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <Show
        when={SearchState.mode() === 'full-text'}
        fallback={<MobileNameResults />}
      >
        <MobileFullTextResults />
      </Show>
    </Suspense>
  );
}
