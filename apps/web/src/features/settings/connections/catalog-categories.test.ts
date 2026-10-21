import { describe, expect, it } from 'vitest';
import { groupCatalogByCategory } from './catalog-categories';

describe('groupCatalogByCategory', () => {
  it('uses the first nonempty Pipedream category without duplicating apps', () => {
    const groups = groupCatalogByCategory([
      {
        app_slug: 'sheets',
        display_name: 'Sheets',
        categories: [' Productivity ', 'Data Analytics'],
      },
      {
        app_slug: 'slack',
        display_name: 'Slack',
        categories: ['', 'Communication'],
      },
      {
        app_slug: 'notion',
        display_name: 'Notion',
        categories: ['Productivity'],
      },
      { app_slug: 'unknown', display_name: 'Unknown' },
    ]);
    expect(groups.map((group) => group.name)).toEqual([
      'Communication',
      'Productivity',
      'Other',
    ]);
    expect(groups[1].entries.map((entry) => entry.app_slug)).toEqual([
      'sheets',
      'notion',
    ]);
    expect(groups.flatMap((group) => group.entries)).toHaveLength(4);
  });

  it('returns no sections for an empty result', () => {
    expect(groupCatalogByCategory([])).toEqual([]);
  });
});
