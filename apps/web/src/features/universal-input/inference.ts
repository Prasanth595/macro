import { universalInputClient } from '@service-cognition/universal-input';
import type { InputCapabilities } from './context/capabilities';

export function createInferenceSource(
  properties: () => Promise<
    { name: string; options: string[] }[]
  > = async () => []
): Pick<InputCapabilities, 'classify' | 'extract'> {
  return {
    ...universalInputClient,
    extract: async (text, intent, revision) =>
      universalInputClient.extract(
        text,
        intent,
        revision,
        intent === 'task' ? await properties() : []
      ),
  };
}
