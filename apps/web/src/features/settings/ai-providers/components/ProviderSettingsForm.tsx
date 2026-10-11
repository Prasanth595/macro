import type {
  ProviderInput,
  ProviderModel,
  ProviderSettings,
  ProviderSettingsInput,
} from '@service-cognition/model-providers';
import { Button, ConfirmDialog, Input } from '@ui';
import { createSignal, For, Index, Show } from 'solid-js';
import { v7 as uuidv7 } from 'uuid';
import { SettingsCard, SettingsSection } from '../../primitives';
import {
  editableProvider,
  providerError,
  qualifiedModel,
  validDefault,
} from '../core/configuration';

export type ProviderSettingsFormProps = {
  settings: ProviderSettings;
  onSave: (input: ProviderSettingsInput) => Promise<ProviderSettings>;
  onDiscover: (input: ProviderInput) => Promise<{ models: ProviderModel[] }>;
};

export function ProviderSettingsForm(props: ProviderSettingsFormProps) {
  const [editing, setEditing] = createSignal<ProviderInput>();
  const [saving, setSaving] = createSignal(false);
  const [discovering, setDiscovering] = createSignal(false);
  const [error, setError] = createSignal('');
  const [notice, setNotice] = createSignal('');
  const [removing, setRemoving] = createSignal<ProviderInput>();
  let draftVersion = 0;
  let draftRevision = props.settings.revision;
  let editorRef: HTMLFormElement | undefined;
  const update = (change: Partial<ProviderInput>) =>
    setEditing((current) => current && { ...current, ...change });
  const begin = (provider: ProviderInput) => {
    draftVersion++;
    draftRevision = props.settings.revision;
    setEditing(provider);
    setError('');
    setNotice('');
    queueMicrotask(() =>
      editorRef?.querySelector<HTMLInputElement>('input')?.focus()
    );
  };
  const save = async (
    providers: ProviderInput[],
    selected = props.settings.default_model
  ) => {
    if (saving()) return false;
    setSaving(true);
    setError('');
    try {
      await props.onSave({
        revision: editing() ? draftRevision : props.settings.revision,
        providers,
        default_model: validDefault(providers, selected),
      });
      setNotice('Provider settings saved.');
      return true;
    } catch {
      setError(
        'Could not save providers. If another editor changed these settings, reload and try again.'
      );
      return false;
    } finally {
      setSaving(false);
    }
  };
  const submit = async () => {
    const provider = editing();
    if (!provider) return;
    const validation = providerError(provider);
    if (validation) {
      setError(validation);
      return;
    }
    const providers = props.settings.providers.map(editableProvider);
    const index = providers.findIndex((entry) => entry.id === provider.id);
    if (index === -1) providers.push(provider);
    else providers[index] = provider;
    if (await save(providers)) setEditing(undefined);
  };
  const discover = async () => {
    const provider = editing();
    if (!provider || discovering()) return;
    const version = draftVersion;
    setDiscovering(true);
    setError('');
    setNotice('');
    try {
      const result = await props.onDiscover(provider);
      const current = editing();
      if (
        !current ||
        draftVersion !== version ||
        current.id !== provider.id ||
        current.base_url !== provider.base_url ||
        current.api_key !== provider.api_key ||
        current.clear_api_key !== provider.clear_api_key
      )
        return;
      // Merge into the latest draft so edits made while connecting survive.
      update({
        models: [
          ...current.models,
          ...result.models.filter(
            (model) =>
              !current.models.some((existing) => existing.id === model.id)
          ),
        ].slice(0, 100),
      });
      setNotice(
        result.models.length
          ? `Connected. Found ${result.models.length} models.`
          : 'Connected. Add your model manually.'
      );
    } catch {
      if (draftVersion !== version || editing()?.id !== provider.id) return;
      setError(
        'Could not discover models. Check the URL and key. If this endpoint does not support discovery, add models manually.'
      );
    } finally {
      setDiscovering(false);
    }
  };
  return (
    <>
      <Show when={!props.settings.can_edit}>
        <p class="text-sm text-ink-muted">
          Team admins manage these providers. You can use the enabled models.
        </p>
      </Show>
      <SettingsSection
        title="Providers"
        description="OpenAI-compatible endpoints, including Ollama, LM Studio, vLLM, and cloud providers."
      >
        <For each={props.settings.providers}>
          {(provider) => (
            <SettingsCard>
              <div class="flex flex-wrap items-center justify-between gap-3 p-4">
                <div class="min-w-0">
                  <h3 class="font-medium text-ink">{provider.name}</h3>
                  <p class="break-all text-sm text-ink-muted">
                    {provider.base_url}
                  </p>
                  <p class="text-sm text-ink-muted">
                    {provider.models.length} models ·{' '}
                    {provider.enabled ? 'Enabled' : 'Disabled'} ·{' '}
                    {provider.has_api_key ? 'API key saved' : 'No API key'}
                  </p>
                </div>
                <Show when={props.settings.can_edit}>
                  <div class="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={saving()}
                      onClick={() => begin(editableProvider(provider))}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={saving()}
                      onClick={() => setRemoving(editableProvider(provider))}
                    >
                      Remove
                    </Button>
                  </div>
                </Show>
              </div>
            </SettingsCard>
          )}
        </For>
        <Show when={!props.settings.providers.length}>
          <p class="text-sm text-ink-muted">
            Add a provider to make its models available in chat and Macro agent
            sessions.
          </p>
        </Show>
        <Show when={props.settings.can_edit && !editing()}>
          <Button
            variant="outline"
            onClick={() =>
              begin({
                id: uuidv7(),
                name: '',
                base_url: '',
                enabled: true,
                models: [],
              })
            }
          >
            Add provider
          </Button>
        </Show>
        <Show when={editing()}>
          {(provider) => (
            <SettingsCard>
              <form
                ref={editorRef}
                class="flex flex-col gap-4 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <h3 class="font-medium text-ink">
                  {props.settings.providers.some((p) => p.id === provider().id)
                    ? 'Edit provider'
                    : 'Add provider'}
                </h3>
                <label class="flex flex-col gap-1 text-sm text-ink">
                  Name
                  <Input
                    required
                    maxlength={100}
                    value={provider().name}
                    placeholder="Local Ollama"
                    onInput={(event) =>
                      update({ name: event.currentTarget.value })
                    }
                  />
                </label>
                <label class="flex flex-col gap-1 text-sm text-ink">
                  API base URL
                  <Input
                    required
                    type="url"
                    value={provider().base_url}
                    placeholder="http://localhost:11434/v1"
                    onInput={(event) =>
                      update({ base_url: event.currentTarget.value })
                    }
                  />
                </label>
                <p class="text-xs text-ink-muted">
                  The endpoint must be reachable from Macro’s server. Local
                  addresses require a local Macro deployment.
                </p>
                <label class="flex flex-col gap-1 text-sm text-ink">
                  API key
                  <Input
                    type="password"
                    autocomplete="new-password"
                    value={provider().api_key ?? ''}
                    placeholder={
                      props.settings.providers.find(
                        (p) => p.id === provider().id
                      )?.has_api_key
                        ? 'Leave blank to keep the saved key'
                        : 'Optional for local endpoints'
                    }
                    onInput={(event) =>
                      update({
                        api_key: event.currentTarget.value,
                        clear_api_key: false,
                      })
                    }
                  />
                </label>
                <Show
                  when={
                    props.settings.providers.find((p) => p.id === provider().id)
                      ?.has_api_key
                  }
                >
                  <label class="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={provider().clear_api_key ?? false}
                      onChange={(event) =>
                        update({
                          clear_api_key: event.currentTarget.checked,
                          api_key: undefined,
                        })
                      }
                    />
                    Remove saved API key
                  </label>
                </Show>
                <div class="flex items-center justify-between">
                  <span class="text-sm text-ink">Enabled</span>
                  <label class="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={provider().enabled}
                      onChange={(event) =>
                        update({ enabled: event.currentTarget.checked })
                      }
                    />
                    Enable provider
                  </label>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h4 class="text-sm font-medium text-ink">Models</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      discovering() || !provider().base_url || !provider().name
                    }
                    onClick={() => void discover()}
                  >
                    {discovering() ? 'Connecting…' : 'Test & discover models'}
                  </Button>
                </div>
                <Index each={provider().models}>
                  {(model, index) => (
                    <div class="flex flex-col gap-2 rounded-md border border-edge-muted p-3">
                      <label class="flex flex-col gap-1 text-sm text-ink">
                        Model ID
                        <Input
                          required
                          value={model().id}
                          placeholder="llama3.2"
                          onInput={(event) =>
                            update({
                              models: provider().models.map((m, i) =>
                                i === index
                                  ? { ...m, id: event.currentTarget.value }
                                  : m
                              ),
                            })
                          }
                        />
                      </label>
                      <label class="flex flex-col gap-1 text-sm text-ink">
                        Display name
                        <Input
                          required
                          maxlength={100}
                          value={model().name}
                          placeholder="Llama 3.2"
                          onInput={(event) =>
                            update({
                              models: provider().models.map((m, i) =>
                                i === index
                                  ? { ...m, name: event.currentTarget.value }
                                  : m
                              ),
                            })
                          }
                        />
                      </label>
                      <div class="flex items-center justify-between gap-3">
                        <label class="flex items-center gap-2 text-sm text-ink">
                          <input
                            type="checkbox"
                            checked={model().supports_images}
                            onChange={(event) =>
                              update({
                                models: provider().models.map((m, i) =>
                                  i === index
                                    ? {
                                        ...m,
                                        supports_images:
                                          event.currentTarget.checked,
                                      }
                                    : m
                                ),
                              })
                            }
                          />
                          Accepts images
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            update({
                              models: provider().models.filter(
                                (_, i) => i !== index
                              ),
                            })
                          }
                        >
                          Remove model
                        </Button>
                      </div>
                    </div>
                  )}
                </Index>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    update({
                      models: [
                        ...provider().models,
                        { id: '', name: '', supports_images: false },
                      ],
                    })
                  }
                >
                  Add model manually
                </Button>
                <div class="flex gap-2">
                  <Button type="submit" disabled={saving() || discovering()}>
                    {saving() ? 'Saving…' : 'Save provider'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={saving()}
                    onClick={() => {
                      draftVersion++;
                      setEditing(undefined);
                      setError('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </SettingsCard>
          )}
        </Show>
      </SettingsSection>
      <SettingsSection
        title="Default model"
        description="Used for new chats and Macro agent sessions. Existing conversations keep their selection."
      >
        <label class="flex flex-col gap-2 text-sm text-ink">
          Workspace default
          <select
            aria-label="Workspace default model"
            class="rounded-md border border-edge-muted bg-input p-2 text-ink"
            value={props.settings.default_model ?? ''}
            disabled={!props.settings.can_edit || saving() || !!editing()}
            onChange={(event) =>
              void save(
                props.settings.providers.map(editableProvider),
                event.currentTarget.value || null
              )
            }
          >
            <option value="" selected={!props.settings.default_model}>
              Use Macro’s default
            </option>
            <For each={props.settings.providers.filter((p) => p.enabled)}>
              {(provider) => (
                <optgroup label={provider.name}>
                  <For each={provider.models}>
                    {(model) => (
                      <option
                        value={qualifiedModel(provider.id, model.id)}
                        selected={
                          props.settings.default_model ===
                          qualifiedModel(provider.id, model.id)
                        }
                      >
                        {model.name}
                      </option>
                    )}
                  </For>
                </optgroup>
              )}
            </For>
          </select>
        </label>
      </SettingsSection>
      <Show when={error()}>
        <p role="alert" class="text-sm text-ink">
          {error()}
        </p>
      </Show>
      <Show when={notice()}>
        <p role="status" class="text-sm text-ink-muted">
          {notice()}
        </p>
      </Show>
      <ConfirmDialog
        open={!!removing()}
        onOpenChange={(open) => {
          if (!open) setRemoving(undefined);
        }}
        title="Remove provider?"
        body="Its models will become unavailable to this workspace. Saved credentials will be removed."
        confirmLabel="Remove"
        pending={saving()}
        onConfirm={async () => {
          const id = removing()?.id;
          if (!id) return;
          if (
            await save(
              props.settings.providers
                .filter((p) => p.id !== id)
                .map(editableProvider)
            )
          ) {
            setRemoving(undefined);
            if (editing()?.id === id) setEditing(undefined);
          }
        }}
      />
    </>
  );
}
