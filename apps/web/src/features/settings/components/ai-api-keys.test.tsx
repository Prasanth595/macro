/** @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

const openSettings = vi.fn();
vi.mock('@core/constant/SettingsState', () => ({
  useSettingsState: () => ({ openSettings }),
}));
vi.mock('@core/component/Toast/Toast', () => ({
  toast: { success: vi.fn(), failure: vi.fn() },
}));
vi.mock('@entity', () => ({ formatRelativeTimestamp: () => '2 days ago' }));
vi.mock('@queries/auth/ai-api-keys', () => ({
  useAiApiKeysQuery: () => ({
    isLoading: false,
    data: {
      keys: [{ provider: 'anthropic', updatedAt: '2026-10-21T12:00:00Z' }],
      usable: false,
    },
  }),
  useSaveAiApiKey: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useRemoveAiApiKey: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

const { AiApiKeys } = await import('./ai-api-keys');

afterEach(cleanup);

describe('AiApiKeys', () => {
  it('keeps a key saved before a downgrade removable but offers no saving', () => {
    const { getByRole, getByLabelText, getByText } = render(() => (
      <AiApiKeys owner="personal" canManage />
    ));

    expect(
      getByText(
        'Your plan doesn’t include your own API keys, so AI chat won’t use the keys below until you upgrade.'
      )
    ).toBeTruthy();
    expect(
      (getByLabelText('Anthropic API key') as HTMLInputElement).disabled
    ).toBe(true);
    expect(
      (getByRole('button', { name: 'Remove' }) as HTMLButtonElement).disabled
    ).toBe(false);

    fireEvent.click(getByRole('button', { name: 'Upgrade' }));
    expect(openSettings).toHaveBeenCalledWith('Billing');
  });
});
