import { Show } from 'solid-js';
import { ProjectDescription } from '../project-description';
import { nextPublicDescriptionGrant } from '../queries/public-project';
import { createPublicProjectDescriptionSession } from '../queries/public-project-description';
import type { PublicDescription } from './public-project';

/** A project's description as a visitor reads it; nothing here creates or changes it. */
export function PublicProjectDescription(props: {
  projectId: string;
  description: PublicDescription;
}) {
  const grant = () =>
    props.description.state === 'live' ? props.description.token : undefined;
  return (
    <Show
      when={grant()}
      fallback={
        <p class="mt-1.5 min-h-24 text-base text-ink-placeholder">
          No description
        </p>
      }
    >
      {(token) => (
        <ProjectDescription
          projectId={props.projectId}
          canEdit={false}
          openSession={(projectId) =>
            createPublicProjectDescriptionSession(
              projectId,
              token(),
              nextPublicDescriptionGrant
            )
          }
        />
      )}
    </Show>
  );
}
