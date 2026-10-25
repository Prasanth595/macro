import { ViewBreadcrumbs, ViewShell } from '@app/components/view-shell';
import { PublicProjectRoute } from '@app/features/projects/public/public-project-view';
import { useFeatureFlag } from '@app/lib/analytics/posthog';
import { useMatches, useNavigate } from '@app/lib/split-router';
import { tasksSplitRoute } from '@app/routes/routes';
import {
  RedirectSplit,
  SignedOutRoute,
} from '@components/app/split-layout/split-router/app-route-shell';
import { SplitPanel } from '@components/app/split-panel';
import { LoadingBlock } from '@core/component/LoadingBlock';
import { enableProjects } from '@core/constant/featureFlags';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { fireAndForget } from '@core/util/fireAndForget';
import { createMemo, type JSX, Match, Show, Switch } from 'solid-js';
import { PublicTaskDetail } from './public-task-detail';
import { publicTasksTarget } from './public-tasks-target';

function ProjectsEnabled(props: { children: JSX.Element }) {
  const flag = useFeatureFlag(enableProjects);
  return (
    <Show
      when={flag().enabled}
      fallback={
        <Show when={!flag().loading} fallback={<LoadingBlock />}>
          <SignedOutRoute />
        </Show>
      }
    >
      {props.children}
    </Show>
  );
}

function StandaloneTask(props: { taskId: string }) {
  const navigate = useNavigate();
  return (
    <Show
      when={!isTouchDevice()}
      fallback={<RedirectSplit to={{ type: 'task', id: props.taskId }} />}
    >
      <ViewBreadcrumbs.Root value={`task:${props.taskId}`} onChange={() => {}}>
        <PublicTaskDetail
          taskId={props.taskId}
          breadcrumbOrder={1}
          onClose={() =>
            fireAndForget(
              navigate({ route: tasksSplitRoute, params: {} }),
              'tasks-view'
            )
          }
        />
      </ViewBreadcrumbs.Root>
    </Show>
  );
}

/**
 * Tasks for a signed-out visitor: a project or task the link makes public,
 * read-only, and the sign-in prompt everywhere else.
 */
export function PublicTasksRouteView() {
  const matches = useMatches();
  const target = createMemo(() => publicTasksTarget(matches()));
  const project = () => {
    const current = target();
    if (current.kind === 'project')
      return { id: current.projectId, section: current.section };
    if (current.kind === 'task' && current.project)
      return { ...current.project, taskId: current.taskId };
  };
  const task = () => {
    const current = target();
    return current.kind === 'task' && !current.project
      ? current.taskId
      : undefined;
  };
  return (
    <SplitPanel.Root>
      <SplitPanel.Body>
        <ViewShell.Root>
          <ViewShell.Main>
            <Switch fallback={<SignedOutRoute />}>
              <Match when={project()}>
                {(project) => (
                  <ProjectsEnabled>
                    <PublicProjectRoute
                      projectId={project().id}
                      section={project().section}
                      taskId={project().taskId}
                    />
                  </ProjectsEnabled>
                )}
              </Match>
              <Match when={task()}>
                {(taskId) => <StandaloneTask taskId={taskId()} />}
              </Match>
            </Switch>
          </ViewShell.Main>
        </ViewShell.Root>
      </SplitPanel.Body>
    </SplitPanel.Root>
  );
}
