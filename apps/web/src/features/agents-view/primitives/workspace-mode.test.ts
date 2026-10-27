import { createRoot } from 'solid-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { createWorkspaceMode } from './workspace-mode';

beforeEach(() => window.localStorage.clear());

describe('workspace mode', () => {
  it('starts in Auto and remembers each choice per user', () => {
    createRoot((dispose) => {
      const workspace = createWorkspaceMode('user-a');
      expect(workspace.mode()).toBe('auto');
      workspace.setMode('code');
      dispose();
    });
    createRoot((dispose) => {
      const workspace = createWorkspaceMode('user-a');
      expect(workspace.mode()).toBe('code');
      expect(createWorkspaceMode('user-b').mode()).toBe('auto');
      workspace.setMode('chat');
      dispose();
    });
    createRoot((dispose) => {
      expect(createWorkspaceMode('user-a').mode()).toBe('chat');
      dispose();
    });
  });

  it('ignores unknown stored values and choices made before Auto existed', () => {
    window.localStorage.setItem('agents-view-mode-v2:user-a', 'agents');
    window.localStorage.setItem('agents-view-mode-v1:user-b', 'code');
    createRoot((dispose) => {
      expect(createWorkspaceMode('user-a').mode()).toBe('auto');
      expect(createWorkspaceMode('user-b').mode()).toBe('auto');
      dispose();
    });
  });
});
