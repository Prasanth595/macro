import { universalInputClient } from '@service-cognition/universal-input';
import type { InputCapabilities } from './context/capabilities';
import { extractedSearchFields } from './core/search';

export function createInferenceSource(
  properties: () => Promise<
    { name: string; options: string[] }[]
  > = async () => []
): Pick<InputCapabilities, 'classify' | 'extract'> {
  return {
    ...universalInputClient,
    extract: async (text, intent, revision) => {
      const response = await universalInputClient.extract(
        text,
        intent,
        revision,
        intent === 'task' ? await properties() : []
      );
      const { search_scope, search_from, search_in, ...suggestions } =
        response.suggestions;
      return {
        ...response,
        suggestions: {
          ...suggestions,
          ...(intent === 'search'
            ? extractedSearchFields(
                {
                  query: suggestions.query,
                  scope: search_scope,
                  from: search_from,
                  in: search_in,
                },
                text
              )
            : {}),
        },
      };
    },
  };
}
