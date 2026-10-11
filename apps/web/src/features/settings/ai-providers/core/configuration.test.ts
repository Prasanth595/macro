import type { ProviderInput } from '@service-cognition/model-providers';
import { describe, expect, it } from 'vitest';
import {
  editableProvider,
  providerError,
  qualifiedModel,
  validDefault,
} from './configuration';

const id = '019a1234-1234-7000-8000-123456789abc';
const provider: ProviderInput = {
  id,
  name: 'Local',
  base_url: 'http://localhost:11434/v1',
  enabled: true,
  models: [{ id: 'llama3.2', name: 'Llama', supports_images: false }],
};
describe('provider configuration', () => {
  it('clears the default when its provider is removed or disabled', () => {
    const model = qualifiedModel(id, 'llama3.2');
    expect(validDefault([provider], model)).toBe(model);
    expect(validDefault([], model)).toBeNull();
    expect(validDefault([{ ...provider, enabled: false }], model)).toBeNull();
  });
  it('requires distinct named models and valid endpoint URLs', () => {
    expect(providerError(provider)).toBeUndefined();
    expect(
      providerError({ ...provider, base_url: 'https://secret@host/v1' })
    ).toBeDefined();
    expect(
      providerError({
        ...provider,
        models: [...provider.models, ...provider.models],
      })
    ).toBeDefined();
    expect(providerError({ ...provider, models: [] })).toBeDefined();
  });
  it('does not synthesize or disclose credentials from redacted settings', () => {
    const editable = editableProvider({ ...provider, has_api_key: true });
    expect(editable).not.toHaveProperty('has_api_key');
    expect(editable).not.toHaveProperty('api_key');
    expect(editable.models).not.toBe(provider.models);
  });
});
