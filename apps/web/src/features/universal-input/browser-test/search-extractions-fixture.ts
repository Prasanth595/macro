import { extractedSearchFields } from '../core/search';

// Fixed provider answers exercise the UI contract without duplicating a language parser.
const answers: Record<
  string,
  { query: string | null; scope?: string; from?: string[]; in?: string[] }
> = {
  'find hiring': { query: 'hiring' },
  'find hiring plan': { query: 'hiring plan' },
  'find how blowholes work': { query: 'how blowholes work' },
  'find how blowholes work in the ocean': {
    query: 'how blowholes work in the ocean',
  },
  'search messages from julia': {
    query: null,
    scope: 'messages',
    from: ['Julia'],
  },
  'search messages from julia in #sales about budget': {
    query: 'budget',
    scope: 'messages',
    from: ['Julia'],
    in: ['sales'],
  },
  'search messages from julia about budget': {
    query: 'budget',
    scope: 'messages',
    from: ['Julia'],
  },
  'search messages from julia about forecast': {
    query: 'forecast',
    scope: 'messages',
    from: ['Julia'],
  },
  'search messages from Pat about budget': {
    query: 'budget',
    scope: 'messages',
    from: ['Pat'],
  },
  'search messages about __budget__': {
    query: '__budget__',
    scope: 'messages',
  },
  'search messages about **budget**': {
    query: '**budget**',
    scope: 'messages',
  },
  'search messages about forecast': { query: 'forecast', scope: 'messages' },
  'search messages in "Julia direct message" about budget': {
    query: 'budget',
    scope: 'messages',
    in: ['Julia direct message'],
  },
  'search documents about Scope': { query: 'Scope', scope: 'documents' },
};

export function fixtureSearchFields(text: string) {
  const answer = answers[text.trim()] ?? { query: text };
  return extractedSearchFields(
    { ...answer, from: answer.from ?? [], in: answer.in ?? [] },
    text
  );
}
