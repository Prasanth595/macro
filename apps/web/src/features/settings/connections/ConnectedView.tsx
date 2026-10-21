import { DEBUG_SETTING_KEYS, useDebugSetting } from '@app/lib/debugSettings';
import CaretRightIcon from '@phosphor/caret-right.svg';
import { For, Show } from 'solid-js';
import { IntegrationRow } from '../primitives';
import { LeftoverRow } from './leftover-row';
import type { ConnectionsModel } from './model';
import { isConnectionsEmpty } from './model';
import { providerIcon } from './provider-meta';
import { useConnectionsView } from './view-state';

export function ConnectedView(props: { model: ConnectionsModel }) {
  const view = useConnectionsView();
  const forceEmpty = useDebugSetting(DEBUG_SETTING_KEYS.FORCE_EMPTY_STATES);
  const pipedreamLeftovers = () =>
    props.model.leftovers.filter((row) => row.kind === 'pipedream');
  const customMcps = () =>
    props.model.leftovers.filter((row) => row.kind === 'native-mcp');
  const showConnectors = () =>
    props.model.providers.length > 0 || pipedreamLeftovers().length > 0;
  return (
    <Show
      when={!forceEmpty() && !isConnectionsEmpty(props.model)}
      fallback={
        <p class="px-4 py-5 text-sm text-ink-muted">
          No tools connected yet. Choose an integration from Discover to get
          started.
        </p>
      }
    >
      <Show when={showConnectors()}>
        <div class="divide-y divide-edge-muted">
          <For each={props.model.providers}>
            {(provider) => (
              <button
                type="button"
                class="w-full text-left outline-none hover:bg-ink/4 focus-visible:bg-ink/6"
                onClick={() => view.openProvider(provider.id)}
              >
                <IntegrationRow
                  icon={providerIcon(provider.id)}
                  title={provider.name}
                  class="gap-2 px-3 py-3"
                  description={
                    <span class="text-sm">
                      {provider.ready} of {provider.total} active
                    </span>
                  }
                  facts={provider.accounts || undefined}
                >
                  <CaretRightIcon class="size-4 text-ink-extra-muted" />
                </IntegrationRow>
              </button>
            )}
          </For>
          <For each={pipedreamLeftovers()}>
            {(leftover) => <LeftoverRow leftover={leftover} />}
          </For>
        </div>
      </Show>

      <Show when={customMcps().length > 0}>
        <div class="border-t border-edge-muted">
          <h3 class="px-4 pt-3 pb-1 text-sm font-medium text-ink-muted">
            Custom MCP servers
          </h3>
          <div class="divide-y divide-edge-muted">
            <For each={customMcps()}>
              {(leftover) => <LeftoverRow leftover={leftover} />}
            </For>
          </div>
        </div>
      </Show>
    </Show>
  );
}
