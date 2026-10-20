import { DEBUG_SETTING_KEYS, useDebugSetting } from '@app/lib/debugSettings';
import CaretRightIcon from '@phosphor/caret-right.svg';
import { For, Show } from 'solid-js';
import { IntegrationRow, SettingsCard, SettingsSection } from '../primitives';
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
        <p class="text-sm text-ink-muted">
          No tools connected yet. Choose an integration from Discover to get
          started.
        </p>
      }
    >
      <Show when={showConnectors()}>
        <SettingsSection>
          <SettingsCard>
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
                    description={
                      <span class="ph-no-capture">{provider.summary}</span>
                    }
                    facts={provider.accounts}
                  >
                    <CaretRightIcon class="size-4 text-ink-extra-muted" />
                  </IntegrationRow>
                </button>
              )}
            </For>
            <For each={pipedreamLeftovers()}>
              {(leftover) => <LeftoverRow leftover={leftover} />}
            </For>
          </SettingsCard>
        </SettingsSection>
      </Show>

      <Show when={customMcps().length > 0}>
        <SettingsSection
          title="Custom MCP"
          description="Servers you added by URL."
        >
          <SettingsCard>
            <For each={customMcps()}>
              {(leftover) => <LeftoverRow leftover={leftover} />}
            </For>
          </SettingsCard>
        </SettingsSection>
      </Show>
    </Show>
  );
}
