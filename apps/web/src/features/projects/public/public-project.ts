import { entityPropertyFromApi } from '@property/api/converters';
import { SYSTEM_PROPERTY_IDS } from '@property/identifiers';
import type { Property } from '@property/types';
import { withProjectStatusOptions } from '@property/utils/select-options';
import type { EntityPropertyWithDefinition } from '@service-properties/generated/schemas/entityPropertyWithDefinition';
import type { PropertyValue } from '@service-properties/generated/schemas/propertyValue';
import type { getInitiativeOverviewResponse } from '@service-storage/generated/zod';
import { match } from 'ts-pattern';
import type { z } from 'zod';
import { PROJECT_PROPERTY_IDS } from '../queries/project-properties';
import type { WorkspaceProject } from '../views/project-workspace';

type Overview = z.infer<typeof getInitiativeOverviewResponse>;
type PropertySnapshot = Overview['tasks'][number]['properties'];

export type PublicDescription = Overview['description'];

export type PublicTask = { id: string; name: string; properties: Property[] };

/** A name the project read handed over, for a viewer who cannot look names up. */
export type PublicPerson = {
  id: string;
  firstName: string | null;
  lastName: string | null;
};

/** What a visitor sees of a project they may only read. */
export type PublicProject = {
  project: WorkspaceProject;
  /** Status, Priority, Assignees and Due date, in composer order. */
  properties: Property[];
  tasks: PublicTask[];
  /** The owner and every assignee shown, whether or not they set a name. */
  people: PublicPerson[];
  description: PublicDescription;
};

function snapshotValue(
  definitionId: string,
  snapshot: PropertySnapshot
): PropertyValue | undefined {
  return match(definitionId)
    .returnType<PropertyValue | undefined>()
    .with(SYSTEM_PROPERTY_IDS.STATUS, () =>
      snapshot.status
        ? { type: 'SelectOption', value: [snapshot.status] }
        : undefined
    )
    .with(SYSTEM_PROPERTY_IDS.PRIORITY, () =>
      snapshot.priority
        ? { type: 'SelectOption', value: [snapshot.priority] }
        : undefined
    )
    .with(SYSTEM_PROPERTY_IDS.ASSIGNEES, () =>
      snapshot.assignees.length
        ? {
            type: 'EntityReference',
            value: snapshot.assignees.map((id) => ({
              entity_type: 'USER',
              entity_id: id,
            })),
          }
        : undefined
    )
    .with(SYSTEM_PROPERTY_IDS.DUE_DATE, () =>
      snapshot.dueDate ? { type: 'Date', value: snapshot.dueDate } : undefined
    )
    .otherwise(() => undefined);
}

/**
 * Builds the page from the project read and the project's own properties,
 * which carry the definitions and option labels the read leaves out. Tasks
 * share those definitions, so their values fill the same templates.
 */
export function publicProject(
  overview: Overview,
  projectProperties: readonly EntityPropertyWithDefinition[]
): PublicProject {
  const templates = PROJECT_PROPERTY_IDS.flatMap((id) => {
    const template = projectProperties.find(
      (property) => property.definition.id === id
    );
    return template ? [template] : [];
  });
  const propertiesOf = (snapshot: PropertySnapshot) =>
    templates.map((template) =>
      entityPropertyFromApi({
        ...template,
        value: snapshotValue(template.definition.id, snapshot),
      })
    );
  const { summary } = overview;
  const names = new Map(overview.people.map((person) => [person.id, person]));
  const shown = new Set([
    overview.ownerId,
    ...summary.properties.assignees,
    ...overview.tasks.flatMap((task) => task.properties.assignees),
  ]);
  return {
    project: {
      id: summary.id,
      name: summary.name,
      ownerId: overview.ownerId,
      updatedAt: summary.updatedAt,
    },
    properties: propertiesOf(summary.properties).map(withProjectStatusOptions),
    tasks: overview.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      properties: propertiesOf(task.properties),
    })),
    people: [...shown].map((id) => ({
      id,
      firstName: names.get(id)?.firstName ?? null,
      lastName: names.get(id)?.lastName ?? null,
    })),
    description: overview.description,
  };
}
