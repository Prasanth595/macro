import { createEditorPreferences } from '@app/lib/preferences/editor-preferences';
import { createRoot } from 'solid-js';
import { beforeEach, expect, it } from 'vitest';

beforeEach(() => localStorage.clear());

it('restores blame preferences after disposing and recreating the owner', () => {
  createRoot((dispose) => {
    const [preferences, setPreferences] = createEditorPreferences();
    expect(preferences.showGitBlame).toBe(true);
    expect(preferences.blameOnlyWhileHoldingAlt).toBe(false);
    setPreferences('blameOnlyWhileHoldingAlt', true);
    setPreferences('showGitBlame', false);
    dispose();
  });
  createRoot((dispose) => {
    const [preferences] = createEditorPreferences();
    expect(preferences.blameOnlyWhileHoldingAlt).toBe(true);
    expect(preferences.showGitBlame).toBe(false);
    dispose();
  });
});

it('uses defaults when saved preferences are invalid', () => {
  localStorage.setItem('macro:pref:editor', '{"showGitBlame":"invalid"}');
  createRoot((dispose) => {
    const [preferences] = createEditorPreferences();
    expect(preferences.showGitBlame).toBe(true);
    expect(preferences.blameOnlyWhileHoldingAlt).toBe(false);
    dispose();
  });
});
