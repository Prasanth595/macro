import { createSoupEntityRow } from '@app/features/soup/collection/rows';
import { SYSTEM_PROPERTY_IDS } from '@property/identifiers';
import { createRoot, createSignal } from 'solid-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { boardEntity, boardProperty } from '../tests/task-board-fixture';
import { createTaskGanttQueries } from './task-gantt-queries';

const fixture = vi.hoisted(() => ({
  definitions: {} as Record<string, unknown>,
  save: vi.fn(async (_input: unknown) => {}),
}));
vi.mock('@queries/storage/document-metadata', () => ({
  useDocumentAccessLevelsQuery: () => {
    throw new Error('Task edits must not prefetch permissions');
  },
}));
vi.mock('@queries/properties/definitions', () => ({
  useListPropertiesQuery: () => fixture.definitions,
}));
vi.mock('@queries/properties/entity', () => ({
  useBulkSaveEntityPropertiesMutation: () => ({ mutateAsync: fixture.save }),
}));
vi.mock('@app/features/projects/queries/project-identity', () => ({
  projectDetailQueryOptions: () => {
    throw new Error('Task moves must not prefetch project permissions');
  },
}));
vi.mock('@core/component/Toast/Toast', () => ({ toast: { failure: vi.fn() } }));

const disposers: (() => void)[] = [];
const move = { id: 'one', fromGroup: 'alice', toGroup: 'bob' };
function setup(
  overrides: Partial<Parameters<typeof createTaskGanttQueries>[0]> = {}
) {
  return createRoot((dispose) => {
    disposers.push(dispose);
    return createTaskGanttQueries({
      rows: () => [
        createSoupEntityRow(
          boardEntity('one', [
            boardProperty(SYSTEM_PROPERTY_IDS.ASSIGNEES, {
              type: 'EntityReference',
              value: [{ entity_id: 'alice', entity_type: 'USER' }],
            }),
          ]),
          { groupId: 'alice' }
        ),
        { kind: 'group-header', id: 'bob', groupId: 'bob', label: 'Bob' },
      ],
      grouping: () => 'assignee',
      projectsEnabled: () => true,
      ...overrides,
    });
  });
}
beforeEach(() => {
  fixture.definitions = {
    isSuccess: true,
    data: [boardProperty(SYSTEM_PROPERTY_IDS.ASSIGNEES, null).definition],
  };
  fixture.save.mockReset();
  fixture.save.mockResolvedValue(undefined);
});
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
});

it('rechecks task presence and source membership on release', async () => {
  const task = boardEntity('one', [
    boardProperty(SYSTEM_PROPERTY_IDS.ASSIGNEES, {
      type: 'EntityReference',
      value: [{ entity_id: 'alice', entity_type: 'USER' }],
    }),
  ]);
  const [present, setPresent] = createSignal(true);
  const source = setup({
    rows: () => [
      ...(present() ? [createSoupEntityRow(task, { groupId: 'alice' })] : []),
      { kind: 'group-header', id: 'bob', groupId: 'bob', label: 'Bob' },
    ],
  });
  expect(source.canMove(move)).toBe(true);
  expect(source.canMove({ ...move, fromGroup: 'stale' })).toBe(false);
  setPresent(false);
  await expect(source.moveGroup(move)).rejects.toThrow('no longer editable');
  expect(fixture.save).not.toHaveBeenCalled();
});

it.each(['USER', 'DOCUMENT'] as const)(
  'rejects an Unassigned drop if another %s assignee appears before release',
  async (entity_type) => {
    const single = boardEntity('one', [
      boardProperty(SYSTEM_PROPERTY_IDS.ASSIGNEES, {
        type: 'EntityReference',
        value: [{ entity_id: 'alice', entity_type: 'USER' }],
      }),
    ]);
    const [task, setTask] = createSignal(single);
    const source = setup({
      rows: () => [
        createSoupEntityRow(task(), { groupId: 'alice' }),
        {
          kind: 'group-header',
          id: 'unassigned',
          groupId: '',
          label: 'Unassigned',
        },
      ],
    });
    const clear = { ...move, toGroup: '' };
    expect(source.canMove(clear)).toBe(true);
    setTask(
      boardEntity('one', [
        boardProperty(SYSTEM_PROPERTY_IDS.ASSIGNEES, {
          type: 'EntityReference',
          value: [
            { entity_id: 'alice', entity_type: 'USER' },
            { entity_id: 'other', entity_type },
          ],
        }),
      ])
    );
    expect(source.canMove(clear)).toBe(false);
    await expect(source.moveGroup(clear)).rejects.toThrow('no longer editable');
    expect(fixture.save).not.toHaveBeenCalled();
    setTask(single);
    await source.moveGroup(clear);
    expect(fixture.save).toHaveBeenCalledWith({
      properties: [
        {
          entityId: 'one',
          entityType: 'TASK',
          property: expect.objectContaining({
            id: SYSTEM_PROPERTY_IDS.ASSIGNEES,
          }),
          apiValues: { valueType: 'ENTITY', refs: null },
        },
      ],
    });
  }
);

it('locks overlapping writes and releases the task after a failed group save', async () => {
  let reject!: (error: Error) => void;
  fixture.save.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      })
  );
  const source = setup();
  const pending = source.moveGroup(move);
  const failed = expect(pending).rejects.toThrow('offline');
  expect(source.canDrag(move.id)).toBe(false);
  await expect(source.moveGroup(move)).rejects.toThrow('no longer editable');
  reject(new Error('offline'));
  await failed;
  expect(source.canDrag(move.id)).toBe(true);
  expect(fixture.save).toHaveBeenCalledOnce();
});

it.each(['none', 'date'] as const)(
  'never edits creation-date groups for %s grouping',
  async (grouping) => {
    const source = setup({ grouping: () => grouping });
    expect(source.canDrag(move.id)).toBe(false);
    await expect(source.moveGroup(move)).rejects.toThrow('no longer editable');
    expect(fixture.save).not.toHaveBeenCalled();
  }
);

it('lets the mutation reject a project move and releases the task lock', async () => {
  fixture.definitions = {
    isSuccess: true,
    data: [boardProperty(SYSTEM_PROPERTY_IDS.PROJECT, null).definition],
  };
  fixture.save.mockRejectedValueOnce(new Error('Forbidden'));
  const source = setup({
    grouping: () => 'project',
    rows: () => [
      createSoupEntityRow(
        boardEntity('one', [
          boardProperty(SYSTEM_PROPERTY_IDS.PROJECT, {
            type: 'EntityReference',
            value: [{ entity_id: 'alice', entity_type: 'INITIATIVE' }],
          }),
        ]),
        { groupId: 'alice' }
      ),
      { kind: 'group-header', id: 'bob', groupId: 'bob', label: 'Bob' },
    ],
  });
  expect(source.canMove(move)).toBe(true);
  await expect(source.moveGroup(move)).rejects.toThrow('Forbidden');
  expect(fixture.save).toHaveBeenCalledOnce();
  expect(source.canDrag(move.id)).toBe(true);
});
