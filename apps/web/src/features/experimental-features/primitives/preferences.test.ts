import { createRoot, createSignal } from 'solid-js';
import { expect, it, vi } from 'vitest';
import { createExperimentalPreferences } from './preferences';

it('shares live edits between mounted consumers and persists them for the account', () => {
  createRoot((dispose) => {
    const left = createExperimentalPreferences(() => 'live-user');
    const right = createExperimentalPreferences(() => 'live-user');
    expect(left.godMode()).toBe(true);
    left.setGodMode(false);
    expect(right.godMode()).toBe(false);
    left.setGodMode(true);
    expect(right.godMode()).toBe(true);
    expect(localStorage.getItem('macro:experimental:god-mode:live-user')).toBe(
      'true'
    );
    right.setGodMode(false);
    expect(left.godMode()).toBe(false);
    dispose();
  });
});

it('keeps account preferences separate when switching users or signing out', () => {
  createRoot((dispose) => {
    const [user, setUser] = createSignal<string | undefined>('switch-alice');
    const state = createExperimentalPreferences(user);
    state.setGodMode(false);
    setUser('switch-bob');
    expect(state.godMode()).toBe(true);
    setUser('switch-alice');
    expect(state.godMode()).toBe(false);
    setUser(undefined);
    state.setGodMode(true);
    expect(state.godMode()).toBe(false);
    dispose();
  });
});

it('retains edits in memory when browser storage is unavailable', () => {
  vi.stubGlobal('localStorage', undefined);
  try {
    createRoot((dispose) => {
      const state = createExperimentalPreferences(() => 'no-storage');
      state.setGodMode(true);
      expect(state.godMode()).toBe(true);
      dispose();
    });
  } finally {
    vi.unstubAllGlobals();
  }
});
