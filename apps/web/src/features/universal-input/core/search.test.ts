import { describe, expect, it } from 'vitest';
import {
  searchFiltersSchema,
  searchNeedsKeywords,
} from '../../next-soup/core/search-filters';
import { compileSearchQuery } from '../../next-soup/core/search-query';
import { resolveSearchFilters, searchPlan } from './search';

const julia = {
  id: 'macro|julia@macro.com',
  label: 'Julia Jones',
  email: 'julia@macro.com',
  kind: 'user' as const,
};
const sales = { id: 'sales-channel', label: 'sales', kind: 'channel' as const };

describe('natural-language global search', () => {
  it('turns the reported example into a Channels sender filter, without a keyword query', () => {
    const plan = searchPlan('search messages from julia');
    expect(plan.query).toBe('');
    expect(plan.filters?.type).toBe('channels');
    const resolved = resolveSearchFilters(
      JSON.stringify(plan.filters),
      [julia],
      [sales]
    );
    expect(resolved.unresolved).toEqual([]);
    expect(resolved.state.channels.from).toEqual([julia.id]);
    expect(compileSearchQuery(resolved.state).include?.channelSenderId).toEqual(
      [julia.id]
    );
  });
  it('separates keywords from a sender and channel, in either order', () => {
    for (const text of [
      'find messages from Julia in #sales about budget',
      'search channel messages in sales from "Julia Jones" containing budget',
    ]) {
      const plan = searchPlan(text);
      expect(plan.query).toBe('budget');
      const resolved = resolveSearchFilters(
        JSON.stringify(plan.filters),
        [julia],
        [sales]
      );
      expect(resolved.state.channels).toEqual({
        in: [sales.id],
        from: [julia.id],
      });
      expect(resolved.unresolved).toEqual([]);
    }
  });
  it.each([
    ['search documents about onboarding', 'document-or-file'],
    ['find tasks', 'task'],
    ['search emails containing invoices', 'email'],
    ['find calls from Julia', 'calls'],
    ['search agents about deployment', 'agent'],
    ['find calendar events about dinner', 'calendar'],
  ])('recognizes %s', (text, type) => {
    expect(searchPlan(text).filters?.type).toBe(type);
  });
  it('does not treat arbitrary query words or unsupported facets as filters', () => {
    expect(searchPlan('how blowholes work')).toEqual({
      query: 'how blowholes work',
    });
    expect(searchPlan('search for quarterly budget')).toEqual({
      query: 'quarterly budget',
    });
    expect(searchPlan('search emails from Julia').query).toBe('from Julia');
  });
  it('does not invent addresses or silently discard unknown and ambiguous people', () => {
    const filters = JSON.stringify(
      searchFiltersSchema.parse({
        type: 'channels',
        channels: { in: [], from: ['Julia'] },
      })
    );
    for (const people of [
      [],
      [
        julia,
        { ...julia, id: 'macro|julia.smith@macro.com', label: 'Julia Smith' },
      ],
    ]) {
      const result = resolveSearchFilters(filters, people, []);
      expect(result.unresolved).toEqual(['Julia']);
      expect(result.state.channels.from).toEqual(['Julia']);
    }
  });
  it('preserves quoted keyword phrases containing from/in and formatted keywords', () => {
    const quoted = searchPlan(
      'search messages containing "the announcement from Julia in sales"'
    );
    expect(quoted.query).toBe('"the announcement from Julia in sales"');
    expect(quoted.filters?.channels).toEqual({ in: [], from: [] });
    expect(searchPlan('search messages about **budget**').query).toBe(
      '**budget**'
    );
  });
  it('requires keywords for sender and speaker constraints that browsing cannot enforce', () => {
    for (const type of ['channels', 'calls'] as const) {
      const state = searchFiltersSchema.parse({
        type,
        [type]: { in: [], from: [julia.id] },
      });
      expect(searchNeedsKeywords(state, '')).toBe(true);
      expect(searchNeedsKeywords(state, 'ab')).toBe(true);
      expect(searchNeedsKeywords(state, 'budget')).toBe(false);
    }
  });
  it('resolves manually selected IDs and exact emails, and normalizes invalid stored state', () => {
    const plan = searchPlan('search messages from julia@macro.com');
    const resolved = resolveSearchFilters(
      JSON.stringify(plan.filters),
      [julia],
      []
    );
    const manual = resolveSearchFilters(
      JSON.stringify(resolved.state),
      [julia],
      []
    );
    expect(manual.unresolved).toEqual([]);
    expect(manual.state.channels.from).toEqual([julia.id]);
    expect(resolveSearchFilters('{"type":"invalid"}', [], []).state.type).toBe(
      'all'
    );
  });
});
