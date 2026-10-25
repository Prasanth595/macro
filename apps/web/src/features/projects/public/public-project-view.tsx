import type { JSX } from 'solid-js';
import type { ProjectSection } from '../core/project';

export function PublicProjectRoute(_props: {
  projectId: string;
  section: ProjectSection;
  taskId?: string;
}): JSX.Element {
  throw new Error('not implemented');
}
