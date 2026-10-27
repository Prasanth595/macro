import { makePersistedState } from '@app/lib/persistence';
import { createUserScopedStorage } from '@core/util/userScopedStorage';
import { createSignal } from 'solid-js';
import type { ComposerMode } from '../core/mode';

const MODES: readonly ComposerMode[] = ['auto', 'chat', 'code'];

/**
 * Whether the new-conversation composer picks the agent kind per prompt
 * (Auto), or always starts chat agents (Chat) or coding agents (Code).
 * Scoped to the signed-in user; a new person starts in Auto.
 */
export function createWorkspaceMode(userId: string | undefined) {
  // v2: Auto became the default, so earlier choices start over in Auto.
  const storage = createUserScopedStorage('agents-view-mode-v2');
  const [mode, setMode] = makePersistedState(
    createSignal<ComposerMode>('auto'),
    {
      storages: {
        restore: () => {
          if (!userId) return;
          const stored = storage.read(userId);
          return MODES.find((mode) => mode === stored);
        },
        write: (value) => {
          if (userId) storage.write(userId, value);
        },
      },
    }
  );
  return { mode, setMode };
}
