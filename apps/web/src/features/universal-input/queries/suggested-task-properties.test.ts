import { PROPERTY_OPTION_IDS, SYSTEM_PROPERTY_IDS } from '@property/constants';
import { describe, expect, it } from 'vitest';
import {
  suggestedTaskProperties,
  type TaskFieldDefinition,
} from './suggested-task-properties';

const priority: TaskFieldDefinition = {
  definition: {
    id: SYSTEM_PROPERTY_IDS.PRIORITY,
    display_name: 'Priority',
    data_type: 'SELECT_STRING',
    is_multi_select: false,
    is_metadata: false,
    is_system: true,
    owner: { scope: 'system' },
    specific_entity_type: null,
    created_at: '',
    updated_at: '',
  },
  options: Object.entries(PROPERTY_OPTION_IDS.PRIORITY).map(
    ([name, id], display_order) => ({
      id,
      value: { type: 'string', value: name.toLowerCase() },
      color: null,
      property_definition_id: SYSTEM_PROPERTY_IDS.PRIORITY,
      display_order,
      created_at: '',
      updated_at: '',
    })
  ),
};
describe('suggested task property resolution', () => {
  it('maps Urgent to the actual priority option, never a model-supplied ID', () => {
    expect(
      suggestedTaskProperties(
        JSON.stringify([{ name: 'Priority', values: ['Urgent'] }]),
        [priority],
        []
      ).values
    ).toEqual({
      [SYSTEM_PROPERTY_IDS.PRIORITY]: {
        valueType: 'SELECT_STRING',
        values: [PROPERTY_OPTION_IDS.PRIORITY.URGENT],
      },
    });
    expect(
      suggestedTaskProperties(
        JSON.stringify([
          { name: 'Priority', values: [PROPERTY_OPTION_IDS.PRIORITY.URGENT] },
        ]),
        [priority],
        []
      ).unresolved
    ).toEqual(['Priority']);
  });
  it('requires a choice for unknown fields and unsupported option names', () => {
    const result = suggestedTaskProperties(
      JSON.stringify([
        { name: 'Priority', values: ['Super urgent'] },
        { name: 'Made up', values: ['yes'] },
      ]),
      [priority],
      []
    );
    expect(result.values).toEqual({});
    expect(result.unresolved).toEqual(['Priority', 'Made up']);
  });
  it('resolves a unique assignee and refuses ambiguous names', () => {
    const assignees: TaskFieldDefinition = {
      definition: {
        ...priority.definition,
        id: SYSTEM_PROPERTY_IDS.ASSIGNEES,
        display_name: 'Assignees',
        data_type: 'ENTITY',
        is_multi_select: true,
        specific_entity_type: 'USER',
      },
      options: [],
    };
    const raw = JSON.stringify([{ name: 'Assignees', values: ['Julia'] }]);
    const people = [
      {
        id: 'julia-a',
        type: 'USER' as const,
        labels: ['Julia', 'julia.a@example.com'],
      },
    ];
    expect(
      suggestedTaskProperties(raw, [assignees], people).values[
        SYSTEM_PROPERTY_IDS.ASSIGNEES
      ]
    ).toEqual({
      valueType: 'ENTITY',
      refs: [{ entity_id: 'julia-a', entity_type: 'USER' }],
    });
    expect(
      suggestedTaskProperties(
        raw,
        [assignees],
        [...people, { id: 'julia-b', type: 'USER', labels: ['Julia'] }]
      ).unresolved
    ).toEqual(['Assignees']);
  });
});
