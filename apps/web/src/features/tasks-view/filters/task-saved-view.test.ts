import { PROPERTY_OPTION_IDS } from '@property/identifiers';
import { describe, expect, it } from 'vitest';
import { TASK_VIEWER } from './task-facets';
import {
  captureTaskSavedView,
  decodeTaskSavedView,
  materializeTaskSavedView,
  taskSavedViewsEqual,
} from './task-saved-view';

const definition = {
  kind: 'tasks',
  version: 1,
  filters: {
    scope: 'assigned-to-viewer',
    statusOptionIds: [PROPERTY_OPTION_IDS.STATUS.IN_PROGRESS],
    priorityOptionIds: [],
    assignees: [
      { type: 'viewer' },
      { type: 'user', id: 'macro|owner@example.com' },
    ],
    creators: [],
    tags: [
      {
        propertyDefinitionId: '10000000-0000-4000-8000-000000000001',
        optionId: '20000000-0000-4000-8000-000000000001',
      },
    ],
  },
};

describe('Task saved-view definitions', () => {
  it('round trips implicit scope, relative people, fixed people, and inaccessible tag bindings', () => {
    const decoded = decodeTaskSavedView(definition);
    expect(decoded.isOk()).toBe(true);
    if (decoded.isErr()) return;
    const restored = materializeTaskSavedView(decoded.value);
    expect(restored.tab).toBe('my-tasks');
    expect(restored.facets.assignees).toContain(TASK_VIEWER);
    expect(restored.facets.assignees).toContain('macro|owner@example.com');
    const captured = captureTaskSavedView({
      ...restored,
      context: { tagPropertyDefinitionByOptionId: restored.tagBindings },
    });
    expect(captured.isOk()).toBe(true);
    if (captured.isErr()) return;
    expect(taskSavedViewsEqual(decoded.value, captured.value)).toBe(true);
  });

  it('does not silently accept an unknown filter or version', () => {
    expect(decodeTaskSavedView({ ...definition, version: 2 }).isErr()).toBe(
      true
    );
    expect(
      decodeTaskSavedView({
        ...definition,
        filters: { ...definition.filters, dueBefore: '2026-11-01' },
      }).isErr()
    ).toBe(true);
    expect(
      captureTaskSavedView({
        tab: 'team-tasks',
        facets: { unknown: ['value'] },
        context: { tagPropertyDefinitionByOptionId: new Map() },
      }).isErr()
    ).toBe(true);
  });

  it('refuses to save a tag without its property definition', () => {
    expect(
      captureTaskSavedView({
        tab: 'team-tasks',
        facets: { tags: ['20000000-0000-4000-8000-000000000001'] },
        context: { tagPropertyDefinitionByOptionId: new Map() },
      }).isErr()
    ).toBe(true);
  });

  it('rejects conflicting property bindings for one tag', () => {
    expect(
      decodeTaskSavedView({
        ...definition,
        filters: {
          ...definition.filters,
          tags: [
            ...definition.filters.tags,
            {
              ...definition.filters.tags[0],
              propertyDefinitionId: '10000000-0000-4000-8000-000000000002',
            },
          ],
        },
      }).isErr()
    ).toBe(true);
  });

  it('treats reordered and repeated selections as the same definition', () => {
    const left = decodeTaskSavedView(definition);
    const right = decodeTaskSavedView({
      ...definition,
      filters: {
        ...definition.filters,
        assignees: [...definition.filters.assignees].reverse(),
        statusOptionIds: [
          ...definition.filters.statusOptionIds,
          ...definition.filters.statusOptionIds,
        ],
      },
    });
    expect(left.isOk() && right.isOk()).toBe(true);
    if (left.isErr() || right.isErr()) return;
    expect(taskSavedViewsEqual(left.value, right.value)).toBe(true);
  });
});
