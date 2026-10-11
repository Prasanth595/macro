import type {
  ProviderInput,
  ProviderSettings,
} from '@service-cognition/model-providers';

export const qualifiedModel = (provider: string, model: string) =>
  `workspace-${provider}/${model}`;
export function editableProvider(
  provider: ProviderSettings['providers'][number]
): ProviderInput {
  const { has_api_key: _, ...input } = provider;
  return { ...input, models: provider.models.map((model) => ({ ...model })) };
}
export function validDefault(
  providers: ProviderInput[],
  selected: string | null
): string | null {
  return selected &&
    providers.some(
      (provider) =>
        provider.enabled &&
        provider.models.some(
          (model) => qualifiedModel(provider.id, model.id) === selected
        )
    )
    ? selected
    : null;
}
export function providerError(provider: ProviderInput): string | undefined {
  if (!provider.name.trim()) return 'Enter a provider name.';
  try {
    const url = new URL(provider.base_url);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return 'Enter an API URL without credentials, query, or fragment.';
  } catch {
    return 'Enter a valid API URL.';
  }
  if (provider.enabled && !provider.models.length)
    return 'Add at least one model before enabling this provider.';
  const ids = new Set<string>();
  for (const model of provider.models) {
    if (
      !model.id.trim() ||
      /\s/.test(model.id) ||
      !model.name.trim() ||
      ids.has(model.id)
    )
      return 'Each model needs a unique id and a display name.';
    ids.add(model.id);
  }
}
