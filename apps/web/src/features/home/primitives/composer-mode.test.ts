import { createRoot, createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createHomeComposerMode,
  HOME_COMPOSER_MODE_KEY,
} from './composer-mode';

const disposals: (() => void)[] = [];
const mount = (available = () => true, userId = () => 'alice') =>
  createRoot((dispose) => {
    disposals.push(dispose);
    return createHomeComposerMode(available, userId);
  });
beforeEach(() => localStorage.clear());
afterEach(() => disposals.splice(0).forEach((dispose) => dispose()));

describe('Home composer mode', () => {
  it('starts in usual mode and remembers each user’s explicit choice', () => {
    const [userId, setUserId] = createSignal('alice');
    const mode = mount(() => true, userId);
    expect(mode.universal()).toBe(false);
    mode.setUniversal(true);
    expect(mount().universal()).toBe(true);
    setUserId('bob');
    expect(mode.universal()).toBe(false);
    setUserId('alice');
    expect(mode.universal()).toBe(true);
    mode.setUniversal(false);
    expect(mount().universal()).toBe(false);
  });
  it('requires flag access even with a stored preference and restores it after re-enabling access', () => {
    const [available, setAvailable] = createSignal(true);
    const mode = mount(available);
    mode.setUniversal(true);
    setAvailable(false);
    expect(mode.universal()).toBe(false);
    mode.setUniversal(false);
    setAvailable(true);
    expect(mode.universal()).toBe(true);
  });
  it('ignores malformed storage values', () => {
    localStorage.setItem(`${HOME_COMPOSER_MODE_KEY}:alice`, 'invalid');
    expect(mount().universal()).toBe(false);
  });
});
