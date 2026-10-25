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
const filtersSchema = z
  .object({
    statusOptionIds: ids,
    priorityOptionIds: ids,
    // Built-in tabs can add the viewer to 100 explicitly selected people.
    assignees: z.array(person).max(101),
    creators: z.array(person).max(101),
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
  .strict();
const schema = z
  .object({
    kind: z.literal('tasks'),
    version: z.literal(1),
    filters: filtersSchema,
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

export type TaskSavedViewIssue = {
  path: string[];
  message: string;
};

export type TaskSavedViewInspection = {
  filters: Record<string, unknown> | undefined;
  issues: TaskSavedViewIssue[];
  recovered: TaskSavedViewConfig | undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Explains invalid data without applying it; recovery requires an explicit new draft. */
export function inspectTaskSavedView(value: unknown): TaskSavedViewInspection {
  const parsed = schema.safeParse(value);
  const issues: TaskSavedViewIssue[] = parsed.success
    ? []
    : parsed.error.issues.flatMap((issue) =>
        issue.code === 'unrecognized_keys'
          ? issue.keys.map((key) => ({
              path: [...issue.path.map(String), key],
              message: 'This field is not supported.',
            }))
          : [{ path: issue.path.map(String), message: issue.message }]
      );
  const filters =
    isRecord(value) && isRecord(value.filters) ? value.filters : undefined;
  if (
    !isRecord(value) ||
    value.kind !== 'tasks' ||
    value.version !== 1 ||
    !filters
  )
    return { filters, issues, recovered: undefined };

  const recover = <T>(
    values: unknown,
    item: z.ZodType<T>,
    limit: number
  ): T[] =>
    Array.isArray(values)
      ? uniqueSorted(
          values.flatMap((value) => {
            const parsed = item.safeParse(value);
            return parsed.success ? [parsed.data] : [];
          }),
          JSON.stringify
        ).slice(0, limit)
      : [];
  const tags = recover(
    filters.tags,
    filtersSchema.shape.tags.element,
    Number.POSITIVE_INFINITY
  );
  const definitions = new Map<string, Set<string>>();
  for (const tag of tags) {
    const ids = definitions.get(tag.optionId) ?? new Set<string>();
    ids.add(tag.propertyDefinitionId);
    definitions.set(tag.optionId, ids);
  }
  const conflicting = new Set(
    [...definitions].filter(([, ids]) => ids.size > 1).map(([id]) => id)
  );
  if (Array.isArray(filters.tags)) {
    filters.tags.forEach((tag, index) => {
      const parsed = filtersSchema.shape.tags.element.safeParse(tag);
      if (parsed.success && conflicting.has(parsed.data.optionId))
        issues.push({
          path: ['filters', 'tags', String(index)],
          message: 'This tag has conflicting property definitions.',
        });
    });
  }
  return {
    filters,
    issues,
    recovered: canonical({
      kind: 'tasks',
      version: 1,
      filters: {
        statusOptionIds: recover(filters.statusOptionIds, identifier, 100),
        priorityOptionIds: recover(filters.priorityOptionIds, identifier, 100),
        assignees: recover(filters.assignees, person, 101),
        creators: recover(filters.creators, person, 101),
        tags: tags
          .filter((tag) => !conflicting.has(tag.optionId))
          .slice(0, 100),
      },
    }),
  };
}

const optionId = (id: string, options: typeof TASK_STATUS_OPTIONS): string =>
  options.find((option) => option.id === id)?.propertyOptionId ?? id;

/** Folds a built-in tab into ordinary person alternatives without losing other filters. */
export function withTaskTabFilters(
  tab: TaskTab,
  facets: FacetSelection
): FacetSelection {
  if (tab === 'my-tasks')
    return {
      ...facets,
      assignees: [...new Set([...(facets.assignees ?? []), TASK_VIEWER])],
    };
  if (tab === 'created-by-me')
    return {
      ...facets,
      'created-by': [
        ...new Set([...(facets['created-by'] ?? []), TASK_VIEWER]),
      ],
    };
  return facets;
}

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
  const facets = withTaskTabFilters(input.tab, input.facets);
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
      statusOptionIds: (input.facets.status ?? []).map((id) =>
        optionId(id, TASK_STATUS_OPTIONS)
      ),
      priorityOptionIds: (input.facets.priority ?? []).map((id) =>
        optionId(id, TASK_PRIORITY_OPTIONS)
      ),
      assignees: people(facets.assignees ?? []),
      creators: people(facets['created-by'] ?? []),
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
    tab: 'team-tasks',
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
