import { describe, expect, it } from 'vitest';
import {
  searchFiltersSchema,
  searchNeedsKeywords,
} from '../../next-soup/core/search-filters';
import { compileSearchQuery } from '../../next-soup/core/search-query';
import { extractedSearchFields, resolveSearchFilters } from './search';

const julia = {
  id: 'macro|julia@macro.com',
  label: 'Julia Jones',
  email: 'julia@macro.com',
  kind: 'user' as const,
};
const sales = { id: 'sales-channel', label: 'sales', kind: 'channel' as const };

describe('model-owned search fields', () => {
  it('keeps the extracted channel while retaining ordinary in/from phrases in the topic', () => {
    const fields = extractedSearchFields(
      {
        query: 'growth in 2026',
        scope: 'messages',
        from: ['Julia'],
        in: ['sales'],
      },
      'search messages from Julia in sales about growth in 2026'
    );
    expect(fields.query).toBe('growth in 2026');
    const resolved = resolveSearchFilters(
      JSON.stringify(fields.searchFilters),
      [julia],
      [sales]
    );
    expect(resolved.state.channels).toEqual({
      from: [julia.id],
      in: [sales.id],
    });
    expect(compileSearchQuery(resolved.state).include?.channelSenderId).toEqual(
      [julia.id]
    );
  });
  it('does not split a model-selected name containing commas or and into multiple people', () => {
    const person = { ...julia, label: 'Julia, Alex and Co' };
    const fields = extractedSearchFields(
      { query: 'budget', scope: 'messages', from: [person.label], in: [] },
      'search messages from "Julia, Alex and Co" about budget'
    );
    const resolved = resolveSearchFilters(
      JSON.stringify(fields.searchFilters),
      [person],
      []
    );
    expect(resolved.unresolved).toEqual([]);
    expect(resolved.state.channels.from).toEqual([person.id]);
  });
  it('keeps a filter-only query empty and rejects unsupported model filter combinations', () => {
    expect(
      extractedSearchFields(
        { query: null, scope: 'messages', from: ['Julia'], in: [] },
        'search messages from Julia'
      ).query
    ).toBe('');
    expect(() =>
      extractedSearchFields(
        { query: 'budget', scope: 'invented', from: ['Julia'], in: [] },
        'draft'
      )
    ).toThrow();
    expect(() =>
      extractedSearchFields(
        { query: 'budget', scope: 'emails', from: ['Julia'], in: [] },
        'draft'
      )
    ).toThrow();
  });
  it('keeps the original query when extraction has no supported scope or keywords', () => {
    expect(
      extractedSearchFields(
        { query: null, scope: null, from: [], in: [] },
        'how blowholes work'
      ).query
    ).toBe('how blowholes work');
  });
  it('does not silently discard unknown or ambiguous identities', () => {
    const filters = JSON.stringify(
      searchFiltersSchema.parse({
        type: 'channels',
        channels: { in: [], from: ['Julia'] },
      })
    );
    for (const people of [
      [],
      [julia, { ...julia, id: 'other', label: 'Julia Smith' }],
    ]) {
      const result = resolveSearchFilters(filters, people, []);
      expect(result.unresolved).toEqual(['Julia']);
      expect(result.state.channels.from).toEqual(['Julia']);
    }
  });
  it('requires keywords for message sender and call speaker constraints', () => {
    for (const type of ['channels', 'calls'] as const) {
      const state = searchFiltersSchema.parse({
        type,
        [type]: { in: [], from: [julia.id] },
      });
      expect(searchNeedsKeywords(state, '')).toBe(true);
      expect(searchNeedsKeywords(state, 'budget')).toBe(false);
    }
  });
});
