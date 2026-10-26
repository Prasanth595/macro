import {
  createSoupEntityRow,
  createSoupGroupHeaderRow,
  createSoupLoadMoreRow,
} from '@app/features/soup/collection/rows';
import { PROPERTY_OPTION_IDS } from '@property/constants';
import { SYSTEM_PROPERTY_IDS } from '@property/identifiers';
import { describe, expect, it } from 'vitest';
import {
  createDateBucketBoundaries,
  taskDueDateUrgency,
} from '../core/task-due-date';
import { boardEntity, boardProperty } from '../tests/task-board-fixture';
import {
  filterTaskBoardColumns,
  taskBoardColumns,
  taskBoardMoveValue,
  toBoardTask,
} from './task-board';

describe('board query projection', () => {
  it('restricts server groups and pagination to selected statuses', () => {
    const allowed = PROPERTY_OPTION_IDS.STATUS.IN_PROGRESS;
    const excluded = PROPERTY_OPTION_IDS.STATUS.COMPLETED;
    const rows = [
      createSoupGroupHeaderRow({ id: excluded, label: 'Completed', count: 10 }),
      createSoupEntityRow(boardEntity('hidden'), { groupId: excluded }),
      createSoupLoadMoreRow({ scopeId: excluded, groupId: excluded }),
      createSoupGroupHeaderRow({
        id: allowed,
        label: 'In progress',
        count: 23,
      }),
      createSoupEntityRow(boardEntity('visible'), { groupId: allowed }),
      createSoupEntityRow(boardEntity('second'), { groupId: allowed }),
      createSoupLoadMoreRow({
        scopeId: allowed,
        groupId: allowed,
        isLoading: true,
      }),
    ];

    const columns = filterTaskBoardColumns(
      taskBoardColumns(rows, 'status', false),
      'status',
      { status: ['in-progress'] }
    );

    expect(columns.map((column) => column.id)).toEqual([allowed]);
    expect(columns[0]).toMatchObject({
      count: 23,
      hasMore: true,
      loadingMore: true,
      tasks: [{ id: 'visible' }, { id: 'second' }],
    });
  });

  it('places the undated column first even when grouped rows arrive later', () => {
    const columns = taskBoardColumns(
      [
        createSoupGroupHeaderRow({ id: 'overdue', label: 'Overdue', count: 1 }),
        createSoupEntityRow(boardEntity('task'), { groupId: 'overdue' }),
      ],
      'due_date',
      false
    );
    expect(columns.map((column) => column.id)).toEqual([
      'no_due_date',
      'overdue',
      'today',
      'tomorrow',
      'next_7_days',
      'later',
    ]);
  });

  it('uses local calendar boundaries and ignores urgency for closed tasks', () => {
    const calendar = createDateBucketBoundaries(
      new Date('2025-03-09T12:00:00Z'),
      'America/New_York'
    );
    expect(taskDueDateUrgency('2025-03-09T04:59:59Z', false, calendar)).toBe(
      'danger'
    );
    expect(taskDueDateUrgency('2025-03-09T05:00:00Z', false, calendar)).toBe(
      'warning'
    );
    expect(taskDueDateUrgency('2025-03-10T04:00:00Z', false, calendar)).toBe(
      'warning'
    );
    expect(taskDueDateUrgency('2025-03-11T03:59:59Z', false, calendar)).toBe(
      'warning'
    );
    expect(
      taskDueDateUrgency('2025-03-11T04:00:00Z', false, calendar)
    ).toBeUndefined();
    expect(
      taskDueDateUrgency('2025-03-17T03:59:59Z', false, calendar)
    ).toBeUndefined();
    expect(
      taskDueDateUrgency('2025-03-09T04:59:59Z', true, calendar)
    ).toBeUndefined();
    expect(taskDueDateUrgency(undefined, false, calendar)).toBeUndefined();
  });

  it('keeps completed and canceled board tasks neutral', () => {
    for (const status of [
      PROPERTY_OPTION_IDS.STATUS.COMPLETED,
      PROPERTY_OPTION_IDS.STATUS.CANCELED,
    ]) {
      const task = boardEntity('closed', [
        boardProperty(
          SYSTEM_PROPERTY_IDS.STATUS,
          { type: 'SelectOption', value: [status] },
          'SELECT_STRING'
        ),
        boardProperty(
          SYSTEM_PROPERTY_IDS.DUE_DATE,
          { type: 'Date', value: '2025-03-08T12:00:00Z' },
          'DATE'
        ),
      ]);
      const projected = toBoardTask(task);
      expect(projected.closed).toBe(true);
    }
  });

  it('deduplicates multi-assignee search placements and preserves hit order when filtering', () => {
    const first = boardEntity('first', [
      boardProperty(SYSTEM_PROPERTY_IDS.ASSIGNEES, {
        type: 'EntityReference',
        value: [
          { entity_id: 'alice', entity_type: 'USER' },
          { entity_id: 'bob', entity_type: 'USER' },
        ],
      }),
    ]);
    const rows = [
      createSoupEntityRow(first),
      createSoupEntityRow(first),
      createSoupEntityRow(
        boardEntity('second', [
          boardProperty(SYSTEM_PROPERTY_IDS.ASSIGNEES, {
            type: 'EntityReference',
            value: [{ entity_id: 'bob', entity_type: 'USER' }],
          }),
        ])
      ),
    ];
    const columns = taskBoardColumns(rows, 'assignee', true);

    expect(
      columns.find((column) => column.id === 'alice')?.tasks
    ).toMatchObject([{ id: 'first' }]);
    expect(columns.find((column) => column.id === 'bob')).toMatchObject({
      count: undefined,
      tasks: [{ id: 'first' }, { id: 'second' }],
    });
    expect(
      filterTaskBoardColumns(columns, 'assignee', {
        assignees: ['bob'],
      }).map((column) => column.id)
    ).toEqual(['bob']);
  });
});

describe('board property writes', () => {
  const entity = boardEntity('task', [
    boardProperty(SYSTEM_PROPERTY_IDS.ASSIGNEES, {
      type: 'EntityReference',
      value: [
        { entity_id: 'alice', entity_type: 'USER' },
        { entity_id: 'agent', entity_type: 'USER' },
      ],
    }),
  ]);

  it('preserves other assignees when replacing one', () => {
    expect(
      taskBoardMoveValue(entity, 'assignee', {
        id: 'task',
        fromLane: 'alice',
        toLane: 'bob',
      })
    ).toEqual({
      valueType: 'ENTITY',
      refs: [
        { entity_id: 'agent', entity_type: 'USER' },
        { entity_id: 'bob', entity_type: 'USER' },
      ],
    });
  });
});
