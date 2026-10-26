import { createRenderEffect, createRoot } from 'solid-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getDisplayName, rememberDisplayNames } from './displayName';
import type { MacroId } from './macroId';

const mocks = vi.hoisted(() => ({ getUserNamesWithEmail: vi.fn() }));
vi.mock('@service-auth/client', () => ({
  authServiceClient: { getUserNamesWithEmail: mocks.getUserNamesWithEmail },
}));

/** Renders `getDisplayName(id)` in a tracked scope, like a JSX label. */
function label(id: MacroId) {
  let shown = '';
  const dispose = createRoot((dispose) => {
    createRenderEffect(() => {
      shown = getDisplayName(id);
    });
    return dispose;
  });
  dispose();
  return shown;
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.getUserNamesWithEmail.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

it('shows a remembered name without looking it up, long after the cache would refresh', async () => {
  const id = 'macro|ada@example.com' as MacroId;
  rememberDisplayNames([{ id, firstName: 'Ada', lastName: null }]);

  expect(label(id)).toBe('Ada');
  await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
  expect(label(id)).toBe('Ada');
  await vi.advanceTimersByTimeAsync(1000);

  expect(mocks.getUserNamesWithEmail).not.toHaveBeenCalled();
});

it('shows someone remembered without a name as their email, without looking them up', async () => {
  const id = 'macro|grace@example.com' as MacroId;
  rememberDisplayNames([{ id, firstName: null, lastName: null }]);

  expect(label(id)).toBe('grace@example.com');
  await vi.advanceTimersByTimeAsync(1000);

  expect(mocks.getUserNamesWithEmail).not.toHaveBeenCalled();
});
