import { describe, expect, it } from 'vitest';
import { parseCacheRevision } from '../../../graphql-cache/protocol';
import type {
  GroupedSoupInitialInput,
  SoupItemFieldsFragment,
} from '../../../service-clients/service-storage/graphql/generated/graphql';
import {
  localSoupGroupKeys,
  projectLocalGroupedSoup,
} from './grouped-local-projection';
import { groupedDocument } from './grouped-test-fixtures';
import { soupItemKey } from './reconciliation';

const input: GroupedSoupInitialInput = {
  groupBy: { field: 'PROPERTY', propertyDefinitionId: 'status-definition' },
  sortMethod: 'UPDATED_AT',
};
const now = new Date('2026-10-10T12:00:00Z');

function snapshot(
  records: SoupItemFieldsFragment[],
  retainedKeys: string[] = []
) {
  return {
    revision: parseCacheRevision('1'),
    optimistic: false,
    keys: [...records.map(soupItemKey), ...retainedKeys],
    retainedKeys,
    records: records.map((record) => ({
      recordKey: soupItemKey(record),
      record,
    })),
  };
}

describe('local grouped Soup projection', () => {
  it('moves normalized rows and removes filter nonmatches without losing unknown rows', () => {
    const a = groupedDocument('a');
    const b = groupedDocument('b');
    const unknown = groupedDocument('unknown');
    const baseline = [
      {
        key: 'todo',
        items: [a, b, unknown],
        totalCount: 30,
        nextCursor: 'more',
      },
    ];
    const next = groupedDocument('a', ['done']);
    const result = projectLocalGroupedSoup(
      baseline,
      snapshot([next], [soupItemKey(unknown)]),
      input,
      now
    );
    expect(result).toEqual([
      { key: 'todo', items: [unknown], totalCount: 28, nextCursor: 'more' },
      { key: 'done', items: [next], totalCount: 1, nextCursor: null },
    ]);
    expect(result[1].items[0]).toBe(next);
    expect(baseline[0].items).toEqual([a, b, unknown]);
  });

  it('uses complete old multi-value membership rather than just loaded bins for count deltas', () => {
    const before = groupedDocument('a', ['todo', 'done']);
    const after = groupedDocument('a', ['done']);
    expect(
      projectLocalGroupedSoup(
        [
          {
            key: 'todo',
            items: [before],
            totalCount: 30,
            nextCursor: 'todo-more',
          },
          { key: 'done', items: [], totalCount: 20, nextCursor: 'done-more' },
        ],
        snapshot([after]),
        input,
        now
      )
    ).toEqual([
      { key: 'todo', items: [], totalCount: 29, nextCursor: 'todo-more' },
      { key: 'done', items: [after], totalCount: 20, nextCursor: 'done-more' },
    ]);
  });

  it('ignores bounded flat candidates outside the baseline', () => {
    expect(
      projectLocalGroupedSoup(
        [],
        snapshot([groupedDocument('new')]),
        input,
        now
      )
    ).toEqual([]);
  });

  it('moves date buckets at midnight using the actual previous bin, not a recomputed old bucket', () => {
    const row = { ...groupedDocument('a'), updatedAt: '2026-10-09T23:30:00Z' };
    expect(
      projectLocalGroupedSoup(
        [{ key: 'today', items: [row], totalCount: 8, nextCursor: 'more' }],
        snapshot([row]),
        { ...input, groupBy: { field: 'DATE' } },
        now
      )
    ).toEqual([
      { key: 'today', items: [], totalCount: 7, nextCursor: 'more' },
      { key: 'yesterday', items: [row], totalCount: 1, nextCursor: null },
    ]);
  });

  it.each([
    ['2026-10-11T00:00:00Z', 'this_week'],
    ['2026-10-10T00:00:00Z', 'today'],
    ['2026-10-09T00:00:00Z', 'yesterday'],
    ['2026-10-04T00:00:00Z', 'this_week'],
    ['2026-10-03T00:00:00Z', 'last_week'],
    ['2026-09-27T00:00:00Z', 'last_week'],
    ['2026-09-26T00:00:00Z', 'this_month'],
    ['2026-09-10T00:00:00Z', 'this_month'],
    ['2026-09-09T00:00:00Z', 'last_month'],
    ['2026-08-11T00:00:00Z', 'last_month'],
    ['2026-08-10T00:00:00Z', 'older'],
  ])('matches grouped SQL date boundaries for %s', (updatedAt, key) => {
    expect(
      localSoupGroupKeys(
        { ...groupedDocument('a'), updatedAt },
        { ...input, groupBy: { field: 'DATE' } },
        now
      )
    ).toEqual([key]);
  });

  it('matches canonical property entity scopes and preserves unsupported viewed-date grouping', () => {
    expect(
      localSoupGroupKeys(
        groupedDocument('a'),
        { ...input, groupBy: { ...input.groupBy, entityType: 'TASK' } },
        now
      )
    ).toEqual(['todo']);
    expect(
      localSoupGroupKeys(
        groupedDocument('a'),
        { ...input, groupBy: { ...input.groupBy, entityType: 'DOCUMENT' } },
        now
      )
    ).toEqual(['']);
    expect(
      localSoupGroupKeys(
        groupedDocument('a'),
        { groupBy: { field: 'DATE' }, sortMethod: 'VIEWED_UPDATED' },
        now
      )
    ).toBeUndefined();
  });

  it('distinguishes known empty property values from unknown grouping evidence', () => {
    expect(localSoupGroupKeys(groupedDocument('a', []), input, now)).toEqual([
      '',
    ]);
    expect(
      localSoupGroupKeys(
        { ...groupedDocument('a'), projectId: 'project-2' },
        { ...input, groupBy: { field: 'PROJECT' } },
        now
      )
    ).toEqual(['project-2']);
    const linked = groupedDocument('a');
    linked.properties[0].value = {
      __typename: 'GraphqlLinkPropertyValue',
      urls: ['https://example.com', 'https://example.com'],
    };
    expect(localSoupGroupKeys(linked, input, now)).toEqual([
      'https://example.com',
    ]);
    linked.properties[0].value = {
      __typename: 'GraphqlNumberPropertyValue',
      numberValue: 3,
    };
    expect(localSoupGroupKeys(linked, input, now)).toEqual(['']);
  });
});
