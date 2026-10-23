import { searchFiltersSchema } from '../../next-soup/core/search-filters';
import type { Intent, Suggestions } from './input';
import { searchPlan } from './search';

function addressing(text: string) {
  const [first, ...lines] = text.trimStart().split('\n');
  const email = first.match(
    /^(?:email(?:\s+to)?|send\s+(?:an?\s+)?email(?:\s+to)?)(?:\s+|$)(.*)$/i
  );
  const message = first.match(
    /^(?:dm|message|send\s+(?:a\s+)?message(?:\s+to)?)(?:\s+|$)(.*)$/i
  );
  const match = email ?? message;
  if (!match) return;
  const inline = match[1].match(/^(.+?)\s+(?:that|saying)\s+(.+)$/i);
  const names = inline?.[1] ?? match[1];
  const body = [inline?.[2] ?? '', ...lines].join('\n').replace(/^\n+/, '');
  return {
    intent: email ? ('email' as const) : ('message' as const),
    recipients: names
      .split(/\s*,\s*|\s+and\s+/i)
      .map((name) => name.trim())
      .filter(Boolean),
    body,
  };
}

const searchPrefix = /^(?:find|search(?:\s+for)?|look\s+for)(?:\s+|$)/i;

/** Explicit addressing provides an immediate shape; names remain suggestions. */
export function localIntent(text: string): Intent | undefined {
  return (
    addressing(text)?.intent ??
    (searchPrefix.test(text.trimStart()) ? 'search' : undefined)
  );
}

/** Seed only fields supported by the text, without resolving identities or dates. */
export function localFields(
  text: string,
  intent: Intent
): Partial<Suggestions> {
  if (intent === 'search') {
    const plan = searchPlan(text);
    return {
      query: plan.query,
      searchFilters: plan.filters ?? searchFiltersSchema.parse({}),
    };
  }
  const address = addressing(text);
  if (address?.intent === intent)
    return { recipients: address.recipients, body: address.body };
  if (intent === 'note')
    return {
      title: text
        .split('\n')[0]
        .replace(/^#{1,6}\s+/, '')
        .trim(),
      body: text,
    };
  if (intent === 'task') return { title: text.split('\n')[0].trim() };
  if (intent === 'email' || intent === 'message') return { body: text };
  return {};
}
