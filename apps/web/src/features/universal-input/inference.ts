import { Telemetry } from '@macro-inc/observability';
import { universalInputClient } from '@service-agent-harness/universal-input';
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from '../next-soup/core/search-options';
import type { InputCapabilities } from './context/capabilities';
import { suggestionsSchema } from './core/input';
import { extractedSearchFields } from './queries/extracted-search';

export function createInferenceSource(
  properties: () => Promise<
    { name: string; options: string[] }[]
  > = async () => [],
  surface: 'command-menu' | 'mobile-search' = 'command-menu'
): Pick<InputCapabilities, 'classify' | 'extract'> {
  return {
    classify: (text, revision) =>
      Telemetry.span('universal_input.classify', async (span) => {
        span.setAttr('input.surface', surface);
        span.setAttr('input.length', text.length);
        span.setAttr('input.revision', revision);
        return universalInputClient.classify(text, revision);
      }),
    extract: (text, intent, revision, searchType) =>
      Telemetry.span('universal_input.extract', async (span) => {
        span.setAttr('input.surface', surface);
        span.setAttr('input.intent', intent);
        span.setAttr('input.length', text.length);
        span.setAttr('input.revision', revision);
        const response = await universalInputClient.extract(
          text,
          intent,
          revision,
          intent === 'task'
            ? await properties()
            : intent === 'search'
              ? [
                  {
                    name: 'Status',
                    options: TASK_STATUS_OPTIONS.map((option) => option.label),
                  },
                  {
                    name: 'Priority',
                    options: TASK_PRIORITY_OPTIONS.map(
                      (option) => option.label
                    ),
                  },
                ]
              : [],
          searchType
        );
        let fields: unknown = response.suggestions;
        if (response.intent === 'search') {
          fields = extractedSearchFields(response.suggestions);
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
      }),
  };
}
