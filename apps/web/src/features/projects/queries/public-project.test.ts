import {
  PROPERTY_OPTION_IDS,
  SYSTEM_PROPERTY_IDS,
} from '@property/identifiers';
import type { Property } from '@property/types';
import type { EntityPropertyWithDefinition } from '@service-properties/generated/schemas/entityPropertyWithDefinition';
import type { PropertyDefinition } from '@service-properties/generated/schemas/propertyDefinition';
import { err, ok } from 'neverthrow';
import { afterEach, describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({
  dssFetch: vi.fn(),
  getEntityProperties: vi.fn(),
}));
vi.mock('@service-storage/client', () => ({ dssFetch: services.dssFetch }));
vi.mock('@service-properties/client', () => ({
  propertiesServiceClient: {
    getEntityProperties: services.getEntityProperties,
  },
}));

import { getInitiativeOverviewResponse } from '@service-storage/generated/zod';
import { publicProject } from '../public/public-project';
import {
  loadPublicProject,
  nextPublicDescriptionGrant,
} from './public-project';

const PROJECT = '01920000-0000-7000-8000-000000000001';
const OWNER = 'macro|owner@macro.com';
const ADA = 'macro|ada@macro.com';
const GRACE = 'macro|grace@macro.com';
const { STATUS, PRIORITY, ASSIGNEES, DUE_DATE } = SYSTEM_PROPERTY_IDS;
const IN_PROGRESS = PROPERTY_OPTION_IDS.STATUS.IN_PROGRESS;
const COMPLETED = PROPERTY_OPTION_IDS.STATUS.COMPLETED;
const HIGH = PROPERTY_OPTION_IDS.PRIORITY.HIGH;

function projectProperty(
  id: string,
  name: string,
  type: PropertyDefinition['data_type'],
  options: [string, string][] = []
): EntityPropertyWithDefinition {
  return {
    definition: {
      id,
      display_name: name,
      data_type: type,
      created_at: '',
      updated_at: '',
      is_system: true,
      is_metadata: false,
      is_multi_select: type === 'ENTITY',
      specific_entity_type: null,
      owner: { scope: 'system' },
    },
    options: options.map(([optionId, label], index) => ({
      id: optionId,
      property_definition_id: id,
      value: { type: 'string', value: label },
      display_order: index,
      color: null,
      created_at: '',
      updated_at: '',
    })),
    property: {
      id: `project-${id}`,
      property_definition_id: id,
      entity_id: PROJECT,
      entity_type: 'INITIATIVE',
      created_at: '',
      updated_at: '',
    },
    value: null,
  };
}

const projectProperties = [
  projectProperty(DUE_DATE, 'Due date', 'DATE'),
  projectProperty(ASSIGNEES, 'Assignees', 'ENTITY'),
  projectProperty(STATUS, 'Status', 'SELECT_STRING', [
    [IN_PROGRESS, 'In progress'],
    [COMPLETED, 'Completed'],
  ]),
  projectProperty('custom', 'Budget', 'NUMBER'),
  projectProperty(PRIORITY, 'Priority', 'SELECT_STRING', [[HIGH, 'High']]),
];

const unset = {
  status: null,
  priority: null,
  assignees: [],
  dueDate: null,
  completed: false,
};

const overview = {
  summary: {
    id: PROJECT,
    name: 'Launch',
    updatedAt: '2026-10-01T00:00:00Z',
    userAccessLevel: 'view',
    properties: { ...unset, status: IN_PROGRESS, assignees: [ADA] },
    taskCount: 1,
    completedTaskCount: 1,
  },
  ownerId: OWNER,
  tasks: [
    {
      id: 'task-1',
      name: 'Pick a date',
      properties: {
        ...unset,
        status: COMPLETED,
        priority: HIGH,
        assignees: [GRACE, ADA],
        dueDate: '2026-11-02T00:00:00Z',
        completed: true,
      },
    },
  ],
  people: [{ id: ADA, firstName: 'Ada', lastName: null }],
  description: { state: 'live', token: 'grant-1' },
};

const wire = () => getInitiativeOverviewResponse.parse(overview);

/** What a pill shows: its name, its value, and labels for selected options. */
function shown(properties: Property[]) {
  return properties.map((property) => ({
    name: property.displayName,
    value: property.value,
    labels: property.options
      ?.filter(
        (option) =>
          Array.isArray(property.value) &&
          property.value.some((value) => value === option.id)
      )
      .map((option) => option.value.value),
  }));
}

afterEach(() => vi.clearAllMocks());

describe('publicProject', () => {
  it("labels the project's and each task's values with the project's definitions, in composer order", () => {
    const page = publicProject(wire(), projectProperties);

    expect(page.project).toEqual({
      id: PROJECT,
      name: 'Launch',
      ownerId: OWNER,
      updatedAt: '2026-10-01T00:00:00Z',
    });
    expect(shown(page.properties)).toEqual([
      { name: 'Status', value: [IN_PROGRESS], labels: ['In progress'] },
      { name: 'Priority', value: null, labels: [] },
      {
        name: 'Assignees',
        value: [{ entity_type: 'USER', entity_id: ADA }],
        labels: [],
      },
      { name: 'Due date', value: null, labels: [] },
    ]);
    expect(page.tasks.map((task) => [task.id, task.name])).toEqual([
      ['task-1', 'Pick a date'],
    ]);
    expect(shown(page.tasks[0].properties)).toEqual([
      { name: 'Status', value: [COMPLETED], labels: ['Completed'] },
      { name: 'Priority', value: [HIGH], labels: ['High'] },
      {
        name: 'Assignees',
        value: [
          { entity_type: 'USER', entity_id: GRACE },
          { entity_type: 'USER', entity_id: ADA },
        ],
        labels: [],
      },
      {
        name: 'Due date',
        value: new Date('2026-11-02T00:00:00Z'),
        labels: [],
      },
    ]);
    expect(page.description).toEqual({ state: 'live', token: 'grant-1' });
  });

  it('names everyone shown once, leaving a profile without a name unnamed', () => {
    const page = publicProject(wire(), projectProperties);

    expect(page.people).toEqual([
      { id: OWNER, firstName: null, lastName: null },
      { id: ADA, firstName: 'Ada', lastName: null },
      { id: GRACE, firstName: null, lastName: null },
    ]);
  });
});

describe('loadPublicProject', () => {
  it('reads the project and the names it shows', async () => {
    services.dssFetch.mockResolvedValue(ok(overview));
    services.getEntityProperties.mockResolvedValue(
      ok({ entity_id: PROJECT, properties: projectProperties })
    );

    const read = await loadPublicProject(PROJECT);

    expect(services.dssFetch).toHaveBeenCalledWith(
      `/initiatives/${PROJECT}/overview`
    );
    expect(services.getEntityProperties).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'INITIATIVE',
        entity_id: PROJECT,
      })
    );
    expect(read.status === 'ready' && read.project.people).toEqual([
      { id: OWNER, firstName: null, lastName: null },
      { id: ADA, firstName: 'Ada', lastName: null },
      { id: GRACE, firstName: null, lastName: null },
    ]);
  });

  it.each(['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND'])(
    'reports a project the visitor may not view (%s) as unavailable',
    async (code) => {
      services.dssFetch.mockResolvedValue(err([{ code, message: code }]));
      services.getEntityProperties.mockResolvedValue(
        err([{ code, message: code }])
      );

      expect(await loadPublicProject(PROJECT)).toEqual({
        status: 'unavailable',
      });
    }
  );

  it.each([
    [
      'the read fails',
      err([{ code: 'SERVER_ERROR', message: 'down' }]),
      ok({ entity_id: PROJECT, properties: projectProperties }),
    ],
    [
      'the read is malformed',
      ok({ ...overview, tasks: 'none' }),
      ok({ entity_id: PROJECT, properties: projectProperties }),
    ],
    [
      'the labels fail',
      ok(overview),
      err([{ code: 'NETWORK_ERROR', message: 'offline' }]),
    ],
  ])('reports a failure when %s', async (_case, read, labels) => {
    services.dssFetch.mockResolvedValue(read);
    services.getEntityProperties.mockResolvedValue(labels);

    expect(await loadPublicProject(PROJECT)).toEqual({
      status: 'failed',
    });
  });
});

describe('nextPublicDescriptionGrant', () => {
  it('asks the project for a fresh read-only grant', async () => {
    services.dssFetch.mockResolvedValue(
      ok({ state: 'live', token: 'grant-2' })
    );

    expect(await nextPublicDescriptionGrant(PROJECT)).toBe('grant-2');
    expect(services.dssFetch).toHaveBeenCalledWith(
      `/initiatives/${PROJECT}/description/token`,
      { method: 'POST' }
    );
  });

  it.each([
    ['the description is gone', ok({ state: 'empty' })],
    ['the grant is refused', err([{ code: 'UNAUTHORIZED', message: 'no' }])],
    ['the answer is malformed', ok({ state: 'live' })],
  ])('has no grant when %s', async (_case, answer) => {
    services.dssFetch.mockResolvedValue(answer);

    expect(await nextPublicDescriptionGrant(PROJECT)).toBeUndefined();
  });
});
