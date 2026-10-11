import { queryReadyGate } from '@queries/gate';
import {
  useDiscoverProviderModels,
  useProviderSettings,
  useSaveProviderSettings,
} from '@queries/model-providers';
import { useUserTeamsQuery } from '@queries/team/teams';
import { Button } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import { SettingsPage, SettingsSection } from '../../primitives';
import { ProviderSettingsForm } from '../components/ProviderSettingsForm';

export function AiProviders() {
  const [teamId, setTeamId] = createSignal<string>();
  const teams = useUserTeamsQuery();
  const settings = useProviderSettings(teamId);
  const save = useSaveProviderSettings();
  const discover = useDiscoverProviderModels();
  return (
    <SettingsPage
      title="AI providers"
      description="Configure models for your workspace using your own provider or a local model server."
    >
      <SettingsSection title="Workspace">
        <label class="flex flex-col gap-2 text-sm text-ink">
          Configure providers for
          <select
            aria-label="Provider workspace"
            class="rounded-md border border-edge-muted bg-input p-2 text-ink"
            value={teamId() ?? ''}
            onChange={(event) =>
              setTeamId(event.currentTarget.value || undefined)
            }
          >
            <option value="">Personal workspace</option>
            <For each={queryReadyGate(teams) ? teams.data : []}>
              {(team) => <option value={team.id}>{team.name}</option>}
            </For>
          </select>
        </label>
      </SettingsSection>
      <Show when={settings.isPending}>
        <p role="status" class="text-sm text-ink-muted">
          Loading providers…
        </p>
      </Show>
      <Show when={settings.isError}>
        <div role="alert" class="flex flex-col gap-2 text-sm text-ink">
          <p>Could not load provider settings.</p>
          <Button variant="outline" onClick={() => void settings.refetch()}>
            Retry
          </Button>
        </div>
      </Show>
      <Show when={queryReadyGate(settings) && (teamId() ?? 'personal')} keyed>
        {(scope) => (
          <ProviderSettingsForm
            settings={settings.data!}
            onSave={(input) =>
              save.mutateAsync({
                input,
                teamId: scope === 'personal' ? undefined : scope,
              })
            }
            onDiscover={(input) =>
              discover.mutateAsync({
                input,
                teamId: scope === 'personal' ? undefined : scope,
              })
            }
          />
        )}
      </Show>
    </SettingsPage>
  );
}
