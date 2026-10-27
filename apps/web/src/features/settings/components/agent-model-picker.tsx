import { ModelCatalogPicker } from '@core/component/AI/component/input/ModelCatalogPicker';
import { fireAndForget } from '@core/util/fireAndForget';
import type { useAgentModelsQueries } from '@queries/agents/models';
import { Button } from '@ui';
import type { ComponentProps } from 'solid-js';
import { Show } from 'solid-js';
import { SettingsSelect } from './settings-select';

type ModelQuery = ReturnType<typeof useAgentModelsQueries>[number];

/**
 * The default-model field for one runtime: loading, retryable error,
 * unsupported, and empty states, then a select or, for a large catalog, the
 * searchable catalog picker.
 */
export function AgentModelPicker(props: {
  /** The runtime's model query; absent when it has no model discovery. */
  query?: ModelQuery;
  runtimeName?: string;
  available: boolean;
  options: ComponentProps<typeof SettingsSelect>['options'];
  catalogOptions: ComponentProps<typeof ModelCatalogPicker>['options'];
  usesCatalog: boolean;
  value: string;
  onChange: (id: string) => void;
}) {
  const runtimeName = () => props.runtimeName ?? 'this runtime';
  return (
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-xs font-medium text-ink-muted">Model</span>
      <Show
        when={props.query}
        fallback={
          <p class="settings-input text-ink-muted">
            Model discovery unavailable
          </p>
        }
        keyed
      >
        {(query) => (
          <Show
            when={!query.isPending}
            fallback={
              <SettingsSelect
                label="Default model"
                options={[]}
                placeholder="Loading models…"
                onChange={props.onChange}
                disabled
              />
            }
          >
            <Show
              when={!query.isError}
              fallback={
                <div class="flex items-center gap-2">
                  <p class="min-w-0 flex-1 text-xs text-negative">
                    Could not load models for {runtimeName()}.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Retry models for ${runtimeName()}`}
                    onClick={() =>
                      fireAndForget(query.refetch(), 'agent-settings')
                    }
                  >
                    Retry
                  </Button>
                </div>
              }
            >
              <Show
                when={props.available}
                fallback={
                  <p class="settings-input text-ink-muted">
                    Model selection is unsupported by this runtime.
                  </p>
                }
              >
                <Show
                  when={props.options.length > 0}
                  fallback={
                    <p class="settings-input text-ink-muted">
                      This runtime did not return any models.
                    </p>
                  }
                >
                  <Show
                    when={props.usesCatalog}
                    fallback={
                      <SettingsSelect
                        label="Default model"
                        options={props.options}
                        value={props.value}
                        onChange={props.onChange}
                      />
                    }
                  >
                    <ModelCatalogPicker
                      value={props.value}
                      options={props.catalogOptions}
                      onSelect={props.onChange}
                      ariaLabel="Default model"
                      triggerClass="w-full justify-between"
                      contentClass="overflow-hidden"
                    />
                  </Show>
                </Show>
              </Show>
            </Show>
          </Show>
        )}
      </Show>
    </div>
  );
}
