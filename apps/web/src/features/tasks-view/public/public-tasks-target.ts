import type { ProjectSection } from '@app/features/projects/core/project';
import type { RouteMatchInfo } from '@app/lib/split-router';
import {
  projectDetailRoute,
  projectTaskRoute,
  taskDetailRoute,
} from '@app/routes/routes';

export type PublicTasksTarget =
  | { kind: 'project'; projectId: string; section: ProjectSection }
  | {
      kind: 'task';
      taskId: string;
      project?: { id: string; section: ProjectSection };
    }
  | { kind: 'none' };

const NONE: PublicTasksTarget = { kind: 'none' };

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function section(value: unknown): ProjectSection | undefined {
  return value === 'overview' || value === 'tasks' ? value : undefined;
}

/**
 * What a signed-out visitor may open at the deepest matched Tasks route. Any
 * other route, including one added later, resolves to `none` and keeps the
 * sign-in prompt.
 */
export function publicTasksTarget(
  matches: readonly RouteMatchInfo[]
): PublicTasksTarget {
  const leaf = matches.at(-1);
  if (!leaf) return NONE;
  if (leaf.id === taskDetailRoute.id) {
    const taskId = text(leaf.params.taskId);
    return taskId ? { kind: 'task', taskId } : NONE;
  }
  const projectMatch = matches.find(
    (match) => match.id === projectDetailRoute.id
  );
  const projectId = text(projectMatch?.params.projectId);
  const projectSection = section(projectMatch?.params.section);
  if (!projectId || !projectSection) return NONE;
  if (leaf.id === projectDetailRoute.id)
    return { kind: 'project', projectId, section: projectSection };
  if (leaf.id === projectTaskRoute.id) {
    const taskId = text(leaf.params.taskId);
    return taskId
      ? {
          kind: 'task',
          taskId,
          project: { id: projectId, section: projectSection },
        }
      : NONE;
  }
  return NONE;
}
