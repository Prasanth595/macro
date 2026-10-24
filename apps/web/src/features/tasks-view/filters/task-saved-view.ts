import type { FacetSelection } from '@app/features/soup/filters/facets/types';
import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';
import type { TaskTab } from '../types';
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  TASK_VIEWER,
  type TaskFacetContext,
} from './task-facets';

const person = z.discriminatedUnion('type', [
  z.object({ type: z.literal('viewer') }).strict(),
  z
    .object({
      type: z.literal('user'),
      id: z
        .string()
        .min(1)
        .max(1024)
        .refine((id) => id !== TASK_VIEWER),
    })
    .strict(),
]);
const identifier = z
  .string()
  .guid()
  .transform((id) => id.toLowerCase());
const ids = z.array(identifier).max(100);
const schema = z
  .object({
    kind: z.literal('tasks'),
    version: z.literal(1),
    filters: z
      .object({
        scope: z.enum(['all', 'assigned-to-viewer', 'created-by-viewer']),
        statusOptionIds: ids,
        priorityOptionIds: ids,
        assignees: z.array(person).max(100),
        creators: z.array(person).max(100),
        tags: z
          .array(
            z
              .object({
                propertyDefinitionId: identifier,
                optionId: identifier,
              })
              .strict()
          )
          .max(100),
      })
      .strict(),
  })
  .strict();

export type TaskSavedViewConfig = z.infer<typeof schema>;

function uniqueSorted<T>(values: T[], key: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [key(value), value])).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

function canonical(config: TaskSavedViewConfig): TaskSavedViewConfig {
  const filters = config.filters;
  return {
    kind: 'tasks',
    version: 1,
    filters: {
      scope: filters.scope,
      statusOptionIds: uniqueSorted(filters.statusOptionIds, String),
      priorityOptionIds: uniqueSorted(filters.priorityOptionIds, String),
      assignees: uniqueSorted(filters.assignees, JSON.stringify),
      creators: uniqueSorted(filters.creators, JSON.stringify),
      tags: uniqueSorted(filters.tags, (tag) => tag.optionId),
    },
  };
}

/** Rejects unknown fields and ambiguous bindings rather than dropping clauses. */
export function decodeTaskSavedView(
  value: unknown
): Result<TaskSavedViewConfig, string> {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    return err('This view contains unsupported or invalid task filters.');
  const definitions = new Map<string, string>();
  for (const tag of parsed.data.filters.tags) {
    const previous = definitions.get(tag.optionId);
    if (previous && previous !== tag.propertyDefinitionId)
      return err('This view contains conflicting tag filters.');
    definitions.set(tag.optionId, tag.propertyDefinitionId);
  }
  return ok(canonical(parsed.data));
}

const optionId = (id: string, options: typeof TASK_STATUS_OPTIONS): string =>
  options.find((option) => option.id === id)?.propertyOptionId ?? id;

/** Captures filters only. Text search and presentation never enter the resource. */
export function captureTaskSavedView(input: {
  tab: TaskTab;
  facets: FacetSelection;
  context: TaskFacetContext;
}): Result<TaskSavedViewConfig, string> {
  if (input.tab === 'projects')
    return err('Open a task list to save its filters.');
  const allowed = new Set([
    'status',
    'priority',
    'assignees',
    'created-by',
    'tags',
  ]);
  if (Object.keys(input.facets).some((id) => !allowed.has(id)))
    return err('These task filters cannot be saved yet.');
  const tags = [];
  for (const id of input.facets.tags ?? []) {
    const definition = input.context.tagPropertyDefinitionByOptionId.get(id);
    if (!definition)
      return err('A selected tag is unavailable. Remove it before saving.');
    tags.push({ optionId: id, propertyDefinitionId: definition });
  }
  const people = (values: string[]) =>
    values.map((id) =>
      id === TASK_VIEWER
        ? { type: 'viewer' as const }
        : { type: 'user' as const, id }
    );
  return decodeTaskSavedView({
    kind: 'tasks',
    version: 1,
    filters: {
      scope:
        input.tab === 'my-tasks'
          ? 'assigned-to-viewer'
          : input.tab === 'created-by-me'
            ? 'created-by-viewer'
            : 'all',
      statusOptionIds: (input.facets.status ?? []).map((id) =>
        optionId(id, TASK_STATUS_OPTIONS)
      ),
      priorityOptionIds: (input.facets.priority ?? []).map((id) =>
        optionId(id, TASK_PRIORITY_OPTIONS)
      ),
      assignees: people(input.facets.assignees ?? []),
      creators: people(input.facets['created-by'] ?? []),
      tags,
    },
  });
}

export function materializeTaskSavedView(config: TaskSavedViewConfig): {
  tab: TaskTab;
  facets: FacetSelection;
  tagBindings: ReadonlyMap<string, string>;
} {
  const filters = config.filters;
  const selectionId = (id: string, options: typeof TASK_STATUS_OPTIONS) =>
    options.find((option) => option.propertyOptionId === id)?.id ?? id;
  const people = (values: TaskSavedViewConfig['filters']['assignees']) =>
    values.map((value) => (value.type === 'viewer' ? TASK_VIEWER : value.id));
  return {
    tab:
      filters.scope === 'assigned-to-viewer'
        ? 'my-tasks'
        : filters.scope === 'created-by-viewer'
          ? 'created-by-me'
          : 'team-tasks',
    facets: {
      status: filters.statusOptionIds.map((id) =>
        selectionId(id, TASK_STATUS_OPTIONS)
      ),
      priority: filters.priorityOptionIds.map((id) =>
        selectionId(id, TASK_PRIORITY_OPTIONS)
      ),
      assignees: people(filters.assignees),
      'created-by': people(filters.creators),
      tags: filters.tags.map((tag) => tag.optionId),
    },
    tagBindings: new Map(
      filters.tags.map((tag) => [tag.optionId, tag.propertyDefinitionId])
    ),
  };
}

export function taskSavedViewsEqual(
  left: TaskSavedViewConfig,
  right: TaskSavedViewConfig
): boolean {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}
