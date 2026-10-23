/**
 * Your own, or your team's, Anthropic and OpenAI keys for AI chat. For a
 * team's, every member sees which providers have a key; admins and the owner
 * add, replace, or remove them. A stored key is never shown again.
 */

import { toast } from '@core/component/Toast/Toast';
import { fireAndForget } from '@core/util/fireAndForget';
import { ThrownResultError } from '@core/util/result';
import { formatRelativeTimestamp } from '@entity';
import {
  type AiApiKeyOwner,
  useAiApiKeysQuery,
  useRemoveAiApiKey,
  useSaveAiApiKey,
} from '@queries/auth/ai-api-keys';
import type { AiProvider } from '@service-auth/generated/schemas/aiProvider';
import { Button, confirmDialog } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import { SettingsCard, SettingsRow, SettingsSection } from '../primitives';

const PROVIDERS: { id: AiProvider; name: string; placeholder: string }[] = [
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-…' },
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-…' },
];

export const TEAM_AI_API_KEYS_DESCRIPTION =
  "Only applies to AI chat. When a member runs out of Macro AI usage, chat continues on your team's key, billed by the provider and not counted against Macro usage. AI editing, call transcription, and other AI features keep using Macro usage.";

export const PERSONAL_AI_API_KEYS_DESCRIPTION =
  "Only applies to AI chat. Turn your key on from the chat composer; when you run out of Macro AI usage, chat continues on it, billed by the provider and not counted against Macro usage. Your key is used before your team's. AI editing, call transcription, and other AI features keep using Macro usage.";

function failureMessage(error: unknown, fallback: string): string {
  return (error instanceof ThrownResultError && error.message) || fallback;
}

export function AiApiKeys(props: { owner: AiApiKeyOwner; canManage: boolean }) {
  const keys = useAiApiKeysQuery(props.owner);
  const save = useSaveAiApiKey(props.owner);
  const remove = useRemoveAiApiKey(props.owner);
  const whose = props.owner === 'personal' ? 'your' : "your team's";
  const [drafts, setDrafts] = createSignal<Partial<Record<AiProvider, string>>>(
    {}
  );

  const stored = (provider: AiProvider) =>
    keys.data?.keys.find((key) => key.provider === provider);
  const draft = (provider: AiProvider) => drafts()[provider] ?? '';
  const setDraft = (provider: AiProvider, value: string) =>
    setDrafts((current) => ({ ...current, [provider]: value }));

  const handleSave = async (provider: AiProvider, name: string) => {
    const apiKey = draft(provider).trim();
    if (apiKey.length === 0 || save.isPending) return;
    try {
      await save.mutateAsync({ provider, apiKey });
      setDraft(provider, '');
      toast.success(`${name} key saved`);
    } catch (error) {
      toast.failure(failureMessage(error, `Failed to save the ${name} key`));
    }
  };

  const handleRemove = async (provider: AiProvider, name: string) => {
    if (remove.isPending) return;
    const confirmed = await confirmDialog({
      title: `Remove the ${name} key?`,
      body: `AI chat stops using ${whose} ${name} key. This removes Macro's copy of the key but does not revoke it at ${name}.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await remove.mutateAsync(provider);
      toast.success(`${name} key removed`);
    } catch (error) {
      toast.failure(failureMessage(error, `Failed to remove the ${name} key`));
    }
  };

  return (
    <SettingsSection
      title="AI chat API keys"
      description={
        props.owner === 'personal'
          ? PERSONAL_AI_API_KEYS_DESCRIPTION
          : TEAM_AI_API_KEYS_DESCRIPTION
      }
    >
      <SettingsCard>
        <For each={PROVIDERS}>
          {(provider) => (
            <SettingsRow
              label={provider.name}
              description={
                <Show
                  when={stored(provider.id)}
                  fallback={keys.isLoading ? 'Loading…' : 'No key'}
                >
                  {(key) =>
                    `Key saved ${formatRelativeTimestamp(key().updatedAt)}`
                  }
                </Show>
              }
              stackOnNarrow
            >
              <Show
                when={props.canManage}
                fallback={
                  <span class="text-xs text-ink-muted">
                    {stored(provider.id) ? 'Connected' : 'Not set'}
                  </span>
                }
              >
                <div class="flex min-w-0 items-center gap-2">
                  <input
                    type="password"
                    autocomplete="off"
                    spellcheck={false}
                    aria-label={`${provider.name} API key`}
                    class="settings-input ph-no-capture w-44 min-w-0"
                    placeholder={
                      stored(provider.id) ? 'Replace key' : provider.placeholder
                    }
                    value={draft(provider.id)}
                    onInput={(event) =>
                      setDraft(provider.id, event.currentTarget.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter')
                        fireAndForget(
                          handleSave(provider.id, provider.name),
                          'ai-api-keys'
                        );
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      draft(provider.id).trim().length === 0 || save.isPending
                    }
                    onClick={() =>
                      fireAndForget(
                        handleSave(provider.id, provider.name),
                        'ai-api-keys'
                      )
                    }
                  >
                    Save
                  </Button>
                  <Show when={stored(provider.id)}>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={remove.isPending}
                      onClick={() =>
                        fireAndForget(
                          handleRemove(provider.id, provider.name),
                          'ai-api-keys'
                        )
                      }
                    >
                      Remove
                    </Button>
                  </Show>
                </div>
              </Show>
            </SettingsRow>
          )}
        </For>
      </SettingsCard>
    </SettingsSection>
  );
}
