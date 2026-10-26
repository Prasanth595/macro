import { describe, expect, it, vi } from 'vitest';
import {
  createDateBucketBoundaries,
  taskDueDatePredicate,
} from '../core/task-due-date';
import { type BuildTaskQueryOptions, buildTaskQuery } from './task-query';
import { buildTaskSearchRequest } from './task-search';

vi.mock('@service-storage/websocket', () => ({
  storageWS: { reconnectIfDisconnected: vi.fn() },
  createWebSocketJob: vi.fn(),
}));
vi.mock('@service-connection/websocket', () => ({
  ws: { addEventListener: vi.fn(), send: vi.fn() },
  state: () => 'closed',
  createConnectionBlockWebsocketEffect: vi.fn(),
  createConnectionWebsocketEffect: vi.fn(),
}));

const options: BuildTaskQueryOptions = {
  tab: 'team-tasks',
  userId: 'user',
  facets: { status: ['in-progress'] },
  groupBy: 'status',
  sort: [{ id: 'updated_at', reversed: true }],
};

describe('task reference scope', () => {
  const reference = {
    propertyDefinitionId: '00000001-0000-0000-0000-00000000000c',
    entityId: 'company-1',
  };

  it('ANDs the referencing property into the list query', () => {
    const query = buildTaskQuery({ ...options, facets: {}, reference });
    expect(query.body.df).toEqual({ l: { dst: 'task' } });
    expect(query.body.propf).toEqual({
      l: { pd: reference.propertyDefinitionId, v: { er: 'company-1' } },
    });
  });

  it('keeps the scope when searching', () => {
    const request = buildTaskSearchRequest({
      query: 'renewal',
      matchType: 'partial',
      tab: 'team-tasks',
      userId: 'user',
      facets: {},
      reference,
    });
    expect(request.body.filters?.property_filters).toEqual([
      {
        property_definition_id: reference.propertyDefinitionId,
        entity_type: 'TASK',
        entity_ids: ['company-1'],
      },
    ]);
  });
});

describe('task CRM scope', () => {
  it('scopes the list to the record without a property-only filter', () => {
    const query = buildTaskQuery({
      ...options,
      facets: {},
      crm: { type: 'company', id: 'company-1' },
    });
    expect(query.body.crma).toEqual({ company: 'company-1' });
    expect(query.body.propf).toBeUndefined();
    expect(query.body.df).toEqual({ l: { dst: 'task' } });
    // Grouping and sort still apply to the scoped list.
    expect(query.groupBy).toEqual({
      type: 'property',
      propertyDefinitionId: '00000001-0000-0000-0000-000000000002',
    });
  });

  it('searches by name inside the same scope', () => {
    const query = buildTaskQuery({
      ...options,
      facets: {},
      crm: { type: 'contact', id: 'contact-1' },
      nameContains: 'renewal',
    });
    expect(query.body.crma).toEqual({ contact: 'contact-1' });
    expect(query.body.df).toEqual({
      '&': [{ l: { dst: 'task' } }, { l: { nc: 'renewal' } }],
    });
  });
});

it('uses the initiative Project property for board columns without changing legacy list grouping', () => {
  const boardQuery = buildTaskQuery({
    ...options,
    groupBy: 'project',
    board: true,
  });
  const listQuery = buildTaskQuery({ ...options, groupBy: 'project' });
  const sortedBoardQuery = buildTaskQuery({ ...options, board: true });

  expect(boardQuery.groupBy).toEqual({
    type: 'property',
    propertyDefinitionId: '00000001-0000-0000-0000-000000000014',
  });
  expect(listQuery.groupBy).toEqual({
    type: 'project',
  });
  expect(sortedBoardQuery.params).toMatchObject({
    sort_method: 'updated_at',
    sort_direction: 'asc',
  });
});

const calendar = createDateBucketBoundaries(
  new Date('2026-11-01T18:00:00Z'),
  'America/New_York'
);

it('combines an exclusive overdue bound with status independently and freezes deadline grouping', () => {
  const dueDate = taskDueDatePredicate({ type: 'overdue' }, calendar);
  const query = buildTaskQuery({
    ...options,
    groupBy: 'due_date',
    sort: [{ id: 'due_date_earliest' }],
    dueDate,
    calendar,
  });
  expect(query.params.sort_method).toBe('property_date_earliest');
  expect(query.params.sort_property_definition_id).toBe(
    '00000001-0000-0000-0000-000000000004'
  );
  expect(query.params.sort_direction).toBeUndefined();
  expect(query.groupBy).toMatchObject({
    type: 'property',
    propertyDefinitionId: '00000001-0000-0000-0000-000000000004',
    bucketing: {
      type: 'date_ranges',
      missingValueBucketKey: 'no_due_date',
      ranges: [
        { key: 'overdue', start: null, end: calendar.boundaries.today },
        {
          key: 'today',
          start: calendar.boundaries.today,
          end: calendar.boundaries.tomorrow,
        },
        {
          key: 'tomorrow',
          start: calendar.boundaries.tomorrow,
          end: calendar.boundaries.day_two,
        },
        {
          key: 'next_7_days',
          start: calendar.boundaries.day_two,
          end: calendar.boundaries.day_eight,
        },
        { key: 'later', start: calendar.boundaries.day_eight, end: null },
      ],
    },
  });
  expect(JSON.stringify(query.body.propf)).toContain(
    '2026-11-01T04:00:00.000Z'
  );
  expect(JSON.stringify(query.body.propf)).toContain(
    '00000001-0000-0000-0002-000000000002'
  );
  expect(JSON.stringify(query.body.propf)).toContain('"end"');
  expect(JSON.stringify(query.body.propf)).toContain('"et":"TASK"');
  expect(JSON.stringify(query.body.propf)).not.toContain('"start"');
});

it('negates date presence and keeps due sorting out of scoped text search', () => {
  const query = buildTaskQuery({
    ...options,
    facets: {},
    dueDate: { hasDate: false },
    sort: [{ id: 'due_date_latest' }],
    searching: true,
    nameContains: 'renewal',
  });
  expect(query.body.propf).toEqual({
    '!': {
      l: { pd: '00000001-0000-0000-0000-000000000004', et: 'TASK', v: 'dp' },
    },
  });
  expect(query.params.sort_method).toBe('updated_at');
});

it.each(['due_date_earliest', 'due_date_latest'] as const)(
  'uses the supported %s wire contract for flat and grouped task requests',
  (sort) => {
    for (const groupBy of ['none', 'due_date'] as const) {
      const query = buildTaskQuery({
        ...options,
        groupBy,
        calendar,
        sort: [{ id: sort }],
      });
      expect(query.params).toEqual({
        expand: true,
        limit: 100,
        sort_method:
          sort === 'due_date_earliest'
            ? 'property_date_earliest'
            : 'property_date_latest',
        sort_property_definition_id: '00000001-0000-0000-0000-000000000004',
        sort_direction: undefined,
      });
      // Exclude the project entity itself, not children of a nil parent.
      expect(query.body.pf).toEqual({
        l: { pids: '00000000-0000-0000-0000-000000000000' },
      });
    }
  }
);
