import { universalInputClient } from '@service-cognition/universal-input';
import type { InputCapabilities } from './context/capabilities';
import { type Draft, draftSchema } from './core/input';

export function createInferenceSource(
  userId: string,
  properties: () => Promise<
    { name: string; options: string[] }[]
  > = async () => []
): Pick<InputCapabilities, 'classify' | 'extract' | 'readDraft' | 'saveDraft'> {
  const key = `macro:universal-input:${userId}`;
  return {
    ...universalInputClient,
    extract: async (text, intent, revision) =>
      universalInputClient.extract(
        text,
        intent,
        revision,
        intent === 'task' ? await properties() : []
      ),
    readDraft() {
      try {
        const value = localStorage.getItem(key);
        return value ? draftSchema.parse(JSON.parse(value)) : undefined;
      } catch {
        return undefined;
      }
    },
    saveDraft(draft: Draft) {
      try {
        if (draft.text) localStorage.setItem(key, JSON.stringify(draft));
        else localStorage.removeItem(key);
      } catch {
        /* Typing remains available when local storage is unavailable. */
      }
    },
  };
}
