import { universalInputClient } from '@service-agent-harness/universal-input';
import type { InputCapabilities } from './context/capabilities';
import { suggestionsSchema } from './core/input';
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
      let fields: unknown = response.suggestions;
      if (response.intent === 'search') {
        fields = extractedSearchFields(
          {
            query: response.suggestions.query,
            scope: response.suggestions.search_scope,
            from: response.suggestions.search_from,
            in: response.suggestions.search_in,
          },
          text
        );
      } else if (response.intent === 'calendar') {
        const recurrence = response.suggestions.recurrence;
        fields = {
          ...response.suggestions,
          recurrence: recurrence
            ? {
                frequency: recurrence.frequency,
                interval: recurrence.interval,
                byDay: recurrence.by_day,
                monthlyByDay: recurrence.monthly_by_day ?? undefined,
                ends: recurrence.ends,
              }
            : null,
        };
      }
      return {
        revision: response.revision,
        intent: response.intent,
        suggestions: suggestionsSchema.parse(fields),
      };
    },
  };
}
