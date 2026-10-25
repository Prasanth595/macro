import type { ProjectSection } from '@app/features/projects/core/project';
import type { RouteMatchInfo } from '@app/lib/split-router';

export type PublicTasksTarget =
  | { kind: 'project'; projectId: string; section: ProjectSection }
  | {
      kind: 'task';
      taskId: string;
      project?: { id: string; section: ProjectSection };
    }
  | { kind: 'none' };

/**
 * What a signed-out visitor may open at the deepest matched Tasks route. Any
 * other route, including one added later, resolves to `none` and keeps the
 * sign-in prompt.
 */
export function publicTasksTarget(
  _matches: readonly RouteMatchInfo[]
): PublicTasksTarget {
  throw new Error('not implemented');
}
