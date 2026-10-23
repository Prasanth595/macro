import { markdownToPlainText } from '@macro-inc/lexical-core/utils/parsers';
import {
  parseSearchFilters,
  type SearchFiltersState,
  type SearchTypeValue,
  searchFiltersSchema,
} from '../../next-soup/core/search-filters';
import { type Recipient, resolveRecipients } from './recipients';

const SEARCH_PREFIX = /^(?:find|search(?:\s+for)?|look\s+for)(?:\s+|$)/i;
const SCOPE =
  /^(?:all\s+)?(channel\s+messages?|messages?|channels?|dms?|documents?|files?|notes?|tasks?|emails?|calls?|folders?|agents?|ai\s+chats?|calendar\s+events?|events?)(?:\s+|$)/i;

function searchType(scope: string): SearchTypeValue {
  if (/^(?:channel|message|dm)/i.test(scope)) return 'channels';
  if (/^(?:document|file|note)/i.test(scope)) return 'document-or-file';
  if (/^task/i.test(scope)) return 'task';
  if (/^email/i.test(scope)) return 'email';
  if (/^call/i.test(scope)) return 'calls';
  if (/^folder/i.test(scope)) return 'folders';
  if (/^(?:calendar|event)/i.test(scope)) return 'calendar';
  return 'agent';
}

function isQuotedAt(text: string, offset: number): boolean {
  let quote: string | undefined;
  for (let index = 0; index < offset; index++) {
    const character = text[index];
    if (text[index - 1] === '\\') continue;
    if (quote) {
      if (character === quote) quote = undefined;
    } else if (
      character === '"' ||
      (character === "'" && (index === 0 || /\s/.test(text[index - 1])))
    )
      quote = character;
  }
  return quote !== undefined;
}

/** Parse explicit search instructions immediately; unknown words stay in the query. */
export function searchPlan(text: string): {
  query: string;
  filters?: SearchFiltersState;
} {
  let query = markdownToPlainText(text)
    .trim()
    .replace(SEARCH_PREFIX, '')
    .trim();
  const scope = query.match(SCOPE);
  if (!scope) return { query };
  const filters = searchFiltersSchema.parse({ type: searchType(scope[1]) });
  query = query.slice(scope[0].length);
  if (
    filters.type === 'channels' ||
    filters.type === 'calls' ||
    filters.type === 'task'
  ) {
    query = query.replace(
      /(?:^|\s)(from|in)\s+(?:"([^"]+)"|'([^']+)'|(.+?))(?=\s+(?:from|in|about|containing|mentioning)\s+|$)/gi,
      (
        clause,
        kind: string,
        quoted: string | undefined,
        single: string | undefined,
        value: string | undefined,
        offset: number
      ) => {
        if (isQuotedAt(query, offset)) return clause;
        const terms = (quoted ?? single ?? value ?? '')
          .split(/\s*(?:,|\band\b)\s*/i)
          .map((term) => term.trim())
          .filter(Boolean);
        if (filters.type === 'task') {
          if (kind.toLowerCase() !== 'from') return clause;
          filters.task.createdBy = terms;
        } else {
          const section =
            filters.type === 'channels' ? filters.channels : filters.calls;
          if (kind.toLowerCase() === 'from') section.from = terms;
          else section.in = terms.map((term) => term.replace(/^#/, ''));
        }
        return ' ';
      }
    );
  }
  query = query.replace(/^\s*(?:about|containing|mentioning)\s+/i, '').trim();
  return { query, filters };
}

/** Resolve against the directory; ambiguous or missing identities cannot broaden a search. */
export function resolveSearchFilters(
  value: string,
  people: Recipient[],
  channels: Recipient[]
) {
  const draft = parseSearchFilters(value);
  const unresolved: string[] = [];
  const resolve = (terms: string[], options: Recipient[]) => {
    const result = resolveRecipients(terms.join(', '), options, false);
    unresolved.push(...result.unresolved);
    return [
      ...result.recipients.map((recipient) => recipient.id),
      ...result.unresolved,
    ];
  };
  const state = { ...draft };
  if (draft.type === 'channels')
    state.channels = {
      in: resolve(draft.channels.in, channels),
      from: resolve(draft.channels.from, people),
    };
  if (draft.type === 'calls')
    state.calls = {
      ...draft.calls,
      in: resolve(draft.calls.in, channels),
      from: resolve(draft.calls.from, people),
    };
  if (draft.type === 'task')
    state.task = {
      ...draft.task,
      assignees: resolve(draft.task.assignees, people),
      createdBy: resolve(draft.task.createdBy, people),
    };
  return { state, draft, unresolved: [...new Set(unresolved)] };
}
