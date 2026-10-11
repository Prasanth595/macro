import type { ProviderSettings } from '@service-cognition/model-providers';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, expect, it, vi } from 'vitest';
import { ProviderSettingsForm } from './ProviderSettingsForm';

vi.mock('../../primitives', () => ({
  SettingsSection: (props: {
    title: string;
    children: import('solid-js').JSX.Element;
  }) => (
    <section>
      <h2>{props.title}</h2>
      {props.children}
    </section>
  ),
  SettingsCard: (props: { children: import('solid-js').JSX.Element }) => (
    <div>{props.children}</div>
  ),
}));
afterEach(cleanup);
const empty: ProviderSettings = {
  revision: 0,
  can_edit: true,
  providers: [],
  default_model: null,
};
it('adds a manual model without remounting its input while typing, and saves it', async () => {
  const save = vi.fn(async (input) => ({
    ...input,
    can_edit: true,
    revision: 1,
    providers: input.providers.map((p: object) => ({
      ...p,
      has_api_key: false,
    })),
  }));
  render(() => (
    <ProviderSettingsForm settings={empty} onSave={save} onDiscover={vi.fn()} />
  ));
  fireEvent.click(screen.getByRole('button', { name: 'Add provider' }));
  fireEvent.input(screen.getByLabelText('Name'), {
    target: { value: 'Ollama' },
  });
  fireEvent.input(screen.getByLabelText('API base URL'), {
    target: { value: 'http://localhost:11434/v1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add model manually' }));
  const modelInput = screen.getByLabelText('Model ID');
  modelInput.focus();
  fireEvent.input(modelInput, { target: { value: 'llama3.2' } });
  expect(screen.getByLabelText('Model ID')).toBe(modelInput);
  expect(document.activeElement).toBe(modelInput);
  fireEvent.input(screen.getByLabelText('Display name'), {
    target: { value: 'Llama 3.2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save provider' }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].providers[0]).toMatchObject({
    name: 'Ollama',
    models: [{ id: 'llama3.2', name: 'Llama 3.2' }],
  });
});
it('shows team configuration read-only for members', () => {
  render(() => (
    <ProviderSettingsForm
      settings={{ ...empty, can_edit: false }}
      onSave={vi.fn()}
      onDiscover={vi.fn()}
    />
  ));
  expect(screen.queryByRole('button', { name: 'Add provider' })).toBeNull();
  expect(
    screen.getByLabelText<HTMLSelectElement>('Workspace default model').disabled
  ).toBe(true);
});
it('preserves a saved key on edits and retains the draft when saving fails', async () => {
  const [settings] = createSignal<ProviderSettings>({
    ...empty,
    revision: 4,
    providers: [
      {
        id: crypto.randomUUID(),
        name: 'Cloud',
        base_url: 'https://cloud.example/v1',
        has_api_key: true,
        enabled: true,
        models: [{ id: 'model', name: 'Model', supports_images: false }],
      },
    ],
  });
  const save = vi.fn(async () => {
    throw new Error('conflict');
  });
  render(() => (
    <ProviderSettingsForm
      settings={settings()}
      onSave={save}
      onDiscover={vi.fn()}
    />
  ));
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(screen.getByLabelText<HTMLInputElement>('API key').value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Save provider' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Could not save')
  );
  expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Cloud');
  expect(save.mock.calls[0]).toBeDefined();
});

it('ignores delayed discovery after switching drafts', async () => {
  let resolve!: (value: {
    models: import('@service-cognition/model-providers').ProviderModel[];
  }) => void;
  const discover = vi.fn(
    () =>
      new Promise<{
        models: import('@service-cognition/model-providers').ProviderModel[];
      }>((done) => {
        resolve = done;
      })
  );
  const settings = {
    ...empty,
    providers: ['First', 'Second'].map((name) => ({
      id: crypto.randomUUID(),
      name,
      base_url: `https://${name.toLowerCase()}.example/v1`,
      has_api_key: false,
      enabled: false,
      models: [],
    })),
  };
  render(() => (
    <ProviderSettingsForm
      settings={settings}
      onSave={vi.fn()}
      onDiscover={discover}
    />
  ));
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
  fireEvent.click(
    screen.getByRole('button', { name: 'Test & discover models' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[1]);
  resolve({
    models: [
      { id: 'first-model', name: 'First model', supports_images: false },
    ],
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Test & discover models' }).textContent
    ).toContain('discover')
  );
  expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Second');
  expect(screen.queryByLabelText('Model ID')).toBeNull();
});
it('keeps model edits made while discovering and rejects stale save revisions', async () => {
  let resolve!: (value: {
    models: import('@service-cognition/model-providers').ProviderModel[];
  }) => void;
  const discover = vi.fn(
    () =>
      new Promise<{
        models: import('@service-cognition/model-providers').ProviderModel[];
      }>((done) => {
        resolve = done;
      })
  );
  const [settings, setSettings] = createSignal({
    ...empty,
    revision: 4,
    providers: [
      {
        id: crypto.randomUUID(),
        name: 'Local',
        base_url: 'http://localhost:11434/v1',
        has_api_key: false,
        enabled: true,
        models: [{ id: 'llama', name: 'Original', supports_images: false }],
      },
    ],
  });
  const save = vi.fn(
    async (
      _input: import('@service-cognition/model-providers').ProviderSettingsInput
    ) => settings()
  );
  render(() => (
    <ProviderSettingsForm
      settings={settings()}
      onSave={save}
      onDiscover={discover}
    />
  ));
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Test & discover models' })
  );
  fireEvent.input(screen.getByLabelText('Display name'), {
    target: { value: 'My label' },
  });
  resolve({
    models: [{ id: 'llama', name: 'Remote label', supports_images: false }],
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Test & discover models' }).textContent
    ).toContain('discover')
  );
  setSettings({ ...settings(), revision: 5 });
  expect(screen.getByLabelText<HTMLInputElement>('Display name').value).toBe(
    'My label'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save provider' }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].revision).toBe(4);
});

it('keeps the selected default when a save replaces provider objects', async () => {
  const provider = {
    id: crypto.randomUUID(),
    name: 'Ollama',
    base_url: 'http://localhost:11434/v1',
    has_api_key: false,
    enabled: true,
    models: [{ id: 'llama', name: 'Llama', supports_images: false }],
  };
  const [settings, setSettings] = createSignal<ProviderSettings>({
    ...empty,
    providers: [provider],
  });
  const save = vi.fn(
    async (
      input: import('@service-cognition/model-providers').ProviderSettingsInput
    ) => {
      const next: ProviderSettings = {
        ...input,
        revision: input.revision + 1,
        can_edit: true,
        providers: input.providers.map((provider) => ({
          ...provider,
          has_api_key: false,
        })),
      };
      setSettings(next);
      return next;
    }
  );
  render(() => (
    <ProviderSettingsForm
      settings={settings()}
      onSave={save}
      onDiscover={vi.fn()}
    />
  ));
  const value = `workspace-${provider.id}/llama`;
  fireEvent.change(screen.getByLabelText('Workspace default model'), {
    target: { value },
  });
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(settings().default_model).toBe(value);
  expect(
    screen.getByLabelText<HTMLSelectElement>('Workspace default model').value
  ).toBe(value);
});
