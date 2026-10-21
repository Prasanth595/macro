import { toast } from '@core/component/Toast/Toast';
import { PipedreamConnectorIcon } from '@core/pipedream/ConnectorIcon';
import {
  createPipedreamCatalogConnect,
  createPipedreamCatalogSearch,
} from '@core/pipedream/catalog';
import { fireAndForget } from '@core/util/fireAndForget';
import CaretRightIcon from '@phosphor/caret-right.svg';
import CheckIcon from '@phosphor/check.svg';
import MagnifyingGlassIcon from '@phosphor/magnifying-glass.svg';
import PlusIcon from '@phosphor/plus.svg';
import SpinnerIcon from '@phosphor/spinner-gap.svg';
import XIcon from '@phosphor/x.svg';
import type { PipedreamCatalogEntryResponse } from '@service-cognition/client';
import { Button, Tooltip } from '@ui';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { ConnectAction } from '../integration-ui';
import { IntegrationRow } from '../primitives';
import { AddCustomMcpDialog } from './add-custom-mcp-dialog';
import type { ConnectionsModel } from './model';
import {
  EMPTY_STARTERS,
  PIPEDREAM_BROWSE_HIDDEN_SLUGS,
  providerIcon,
} from './provider-meta';
import { useConnectionsView } from './view-state';

export function DiscoverView(props: { model: ConnectionsModel }) {
  const view = useConnectionsView();
  const alreadyHave = createMemo(() => {
    const slugs = new Set<string>();
    for (const row of props.model.capabilities) {
      if (row.status !== 'not-connected') slugs.add(row.provider);
    }
    for (const leftover of props.model.leftovers) {
      if (leftover.kind === 'pipedream') slugs.add(leftover.appSlug);
    }
    return slugs;
  });
  const catalog = createPipedreamCatalogSearch(
    () => PIPEDREAM_BROWSE_HIDDEN_SLUGS
  );
  const [addingCustom, setAddingCustom] = createSignal(false);

  const featured = createMemo(() => {
    const query = catalog.searchInput().trim().toLowerCase();
    return EMPTY_STARTERS.filter((item) => {
      const haystack = `${item.name} ${item.note}`.toLowerCase();
      return !query || haystack.includes(query);
    });
  });

  const rest = createMemo(() => {
    const query = catalog.search().trim().toLowerCase();
    return catalog.entries().filter((entry) => {
      if (!query) return true;
      return `${entry.display_name} ${entry.description ?? ''} ${entry.app_slug}`
        .toLowerCase()
        .includes(query);
    });
  });

  return (
    <div class="@container/catalog flex flex-col gap-8">
      <div class="grid grid-cols-1 gap-2 @[440px]/catalog:grid-cols-[minmax(0,1fr)_auto]">
        <label class="relative block min-w-0">
          <span class="sr-only">Search integrations</span>
          <MagnifyingGlassIcon
            class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={catalog.searchInput()}
            onInput={(event) =>
              catalog.onSearchInput(event.currentTarget.value)
            }
            placeholder="Search integrations"
            class="h-10 w-full rounded-full border border-edge-muted bg-panel pr-10 pl-9 text-sm text-ink outline-none placeholder:text-ink-muted focus-visible:border-edge-focus focus-visible:ring-1 focus-visible:ring-edge-focus [&::-webkit-search-cancel-button]:hidden"
          />
          <Show when={catalog.searchInput()}>
            <button
              type="button"
              aria-label="Clear search"
              class="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted outline-none hover:bg-ink/4 hover:text-ink focus-visible:bg-ink/6"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => catalog.onSearchInput('')}
            >
              <XIcon class="size-4" />
            </button>
          </Show>
        </label>
        <Button
          variant="outline"
          size="md"
          class="h-10 px-4"
          onClick={() => setAddingCustom(true)}
        >
          <PlusIcon class="size-4" /> Add custom MCP
        </Button>
      </div>

      <section aria-label="Featured integrations">
        <h3 class="mb-3 text-sm font-medium text-ink-muted">Featured</h3>
        <div class="grid grid-cols-1 gap-3 @[440px]/catalog:grid-cols-2">
          <For each={featured()}>
            {(item) => (
              <div class="@container overflow-hidden rounded-2xl border border-edge-muted">
                <button
                  type="button"
                  class="flex h-full w-full flex-col items-stretch text-left outline-none hover:bg-ink/4 focus-visible:bg-ink/6"
                  onClick={() => view.openProvider(item.id)}
                >
                  <IntegrationRow
                    icon={providerIcon(item.id)}
                    title={item.name}
                    class="gap-3 px-4 py-4"
                  >
                    <Show when={alreadyHave().has(item.id)}>
                      <AddedMark />
                    </Show>
                    <CaretRightIcon class="size-4 text-ink-extra-muted" />
                  </IntegrationRow>
                </button>
              </div>
            )}
          </For>
        </div>
        <Show when={featured().length === 0}>
          <p class="text-sm text-ink-muted">No featured Connections match.</p>
        </Show>
      </section>

      <section aria-label="All integrations">
        <h3 class="mb-3 text-sm font-medium text-ink-muted">All apps</h3>
        <div class="overflow-hidden rounded-2xl border border-edge-muted divide-y divide-edge-muted">
          <Show when={catalog.query.isError}>
            <div class="px-6 py-6 text-center text-sm text-ink-muted">
              Couldn't load the connector catalog.
              <Button
                variant="outline"
                size="sm"
                depth={3}
                onClick={() => catalog.query.refetch()}
                class="ml-2"
              >
                Retry
              </Button>
            </div>
          </Show>
          <Show when={!catalog.query.isError}>
            <For each={rest()}>
              {(entry) => (
                <CatalogRow
                  entry={entry}
                  added={alreadyHave().has(entry.app_slug)}
                />
              )}
            </For>
            <Show
              when={
                !catalog.query.isFetching &&
                rest().length === 0 &&
                catalog.search().trim()
              }
            >
              <p class="px-6 py-6 text-sm text-ink-muted">
                No Connections match that search.
              </p>
            </Show>
            <Show when={catalog.query.isFetching}>
              <div
                class="flex justify-center px-6 py-6"
                role="status"
                aria-label="Loading"
              >
                <SpinnerIcon class="size-4 animate-spin text-ink-muted" />
              </div>
            </Show>
            <Show
              when={
                rest().length > 0 &&
                !catalog.query.isFetching &&
                catalog.query.hasNextPage
              }
            >
              <div class="px-4 py-3 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  depth={3}
                  onClick={() =>
                    fireAndForget(
                      catalog.query.fetchNextPage(),
                      'connections-settings'
                    )
                  }
                >
                  Load more
                </Button>
              </div>
            </Show>
          </Show>
        </div>
      </section>

      <AddCustomMcpDialog
        open={addingCustom()}
        onOpenChange={setAddingCustom}
        onAdded={view.showOverview}
      />
    </div>
  );
}

function AddedMark() {
  return (
    <span
      class="inline-flex shrink-0 items-center gap-1 text-sm text-ink-muted"
      aria-label="Added"
    >
      <CheckIcon class="size-3.5" />
      <span class="hidden @[16rem]:inline" aria-hidden="true">
        Added
      </span>
    </span>
  );
}

function CatalogRow(props: {
  entry: PipedreamCatalogEntryResponse;
  added: boolean;
}) {
  const { connect, busy } = createPipedreamCatalogConnect({
    entry: () => props.entry,
    onConnected: (entry) => toast.success(`${entry.display_name} connected`),
  });

  const name = () => props.entry.display_name;
  const descriptionId = `discover-connect-${props.entry.app_slug}`;
  const description = props.entry.description ?? props.entry.app_slug;

  const row = () => (
    <IntegrationRow
      icon={
        <PipedreamConnectorIcon
          appSlug={props.entry.app_slug}
          iconUrl={props.entry.icon_url}
          class="size-8"
        />
      }
      class="gap-3 px-4 py-3"
      title={name()}
      description={
        <Tooltip label={description}>
          <span id={descriptionId} class="not-touch:line-clamp-2 text-sm">
            {description}
          </span>
        </Tooltip>
      }
    >
      <Show
        when={props.added}
        fallback={<ConnectAction label="Connect" loading={busy()} />}
      >
        <AddedMark />
      </Show>
    </IntegrationRow>
  );

  return (
    <Show when={!props.added} fallback={row()}>
      <button
        type="button"
        class="w-full text-left outline-none hover:bg-ink/4 focus-visible:bg-ink/6"
        aria-label={busy() ? `Connecting ${name()}` : `Connect ${name()}`}
        aria-describedby={descriptionId}
        aria-busy={busy()}
        disabled={busy()}
        onClick={() => fireAndForget(connect(), 'connections-settings')}
      >
        {row()}
      </button>
    </Show>
  );
}
