import { makePersistedState } from '@app/lib/persistence';
import { createAssertedContextProvider } from '@core/context/createContext';
import { createStore } from 'solid-js/store';
import { z } from 'zod';

const editorPreferencesSchema = z.object({
  showGitBlame: z.boolean().default(true),
  blameOnlyWhileHoldingAlt: z.boolean().default(false),
});
const STORAGE_KEY = 'macro:pref:editor';

export function createEditorPreferences() {
  return makePersistedState(createStore(editorPreferencesSchema.parse({})), {
    storages: {
      restore: () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const parsed = editorPreferencesSchema.safeParse(JSON.parse(stored));
        return parsed.success ? parsed.data : undefined;
      },
      write: (value) =>
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value)),
    },
  });
}

export const [EditorPreferencesProvider, useEditorPreferences] =
  createAssertedContextProvider('EditorPreferences', createEditorPreferences);
