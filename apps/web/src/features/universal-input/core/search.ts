import {
  parseSearchFilters,
  type SearchTypeValue,
  searchFiltersSchema,
} from '../../next-soup/core/search-filters';
import { type Recipient, resolveRecipientTerms } from './recipients';

const searchScopes: Record<string, SearchTypeValue> = {
  all: 'all',
  channel: 'channels',
  channels: 'channels',
  message: 'channels',
  messages: 'channels',
  'channel message': 'channels',
  'channel messages': 'channels',
  dm: 'channels',
  dms: 'channels',
  'direct message': 'channels',
  'direct messages': 'channels',
  document: 'document-or-file',
  documents: 'document-or-file',
  file: 'document-or-file',
  files: 'document-or-file',
  note: 'document-or-file',
  notes: 'document-or-file',
  task: 'task',
  tasks: 'task',
  email: 'email',
  emails: 'email',
  call: 'calls',
  calls: 'calls',
  folder: 'folders',
  folders: 'folders',
  agent: 'agent',
  agents: 'agent',
  'ai chat': 'agent',
  'ai chats': 'agent',
  calendar: 'calendar',
  event: 'calendar',
  events: 'calendar',
  'calendar event': 'calendar',
  'calendar events': 'calendar',
};

/** Normalize model-selected category values; never scan the source for filter clauses. */
export function extractedSearchFields(
  input: {
    query?: string | null;
    scope?: string | null;
    from: string[];
    in: string[];
  },
  source: string
) {
  const scope = input.scope?.trim().toLowerCase();
  const type = scope
    ? Object.hasOwn(searchScopes, scope)
      ? searchScopes[scope]
      : undefined
    : 'all';
  if (!type) throw new Error('Choose a search type');
  const filters = searchFiltersSchema.parse({ type });
  if (type === 'channels' || type === 'calls') {
    filters[type] = { in: input.in, from: input.from };
  } else if (type === 'task' && input.in.length === 0) {
    filters.task.createdBy = input.from;
  } else if (input.from.length || input.in.length) {
    throw new Error('Choose supported search filters');
  }
  return {
    query: input.query ?? (scope ? '' : source),
    searchFilters: filters,
  };
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
    const result = resolveRecipientTerms(terms, options, false);
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
