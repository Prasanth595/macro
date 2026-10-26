import { EntityDetailTopBar } from '@app/components/entity-detail/EntityDetailTopBar';
import { ViewBreadcrumbs } from '@app/components/view-shell';
import { PublicTaskDetail } from '@app/features/tasks-view/public/public-task-detail';
import { useNavigate } from '@app/lib/split-router';
import { projectDetailRoute, projectTaskRoute } from '@app/routes/routes';
import { SidePanel } from '@components/app/side-panel';
import { useSplitDisplayName } from '@components/app/split-layout/layoutUtils';
import { SignedOutRoute } from '@components/app/split-layout/split-router/app-route-shell';
import { LoginButton } from '@core/component/TopBar/LoginButton';
import { rememberDisplayNames } from '@core/user/displayName';
import { fireAndForget } from '@core/util/fireAndForget';
import StackIcon from '@phosphor/stack.svg';
import { useQuery } from '@tanstack/solid-query';
import { Button, EmptyStatePanel, Tabs } from '@ui';
import { createMemo, Match, Show, Switch } from 'solid-js';
import { ProjectContentSkeleton } from '../components/project-skeletons';
import type { ProjectSection } from '../core/project';
import {
  type PublicProjectRead,
  publicProjectQueryOptions,
} from '../queries/public-project';
import { ProjectWorkspace } from '../views/project-workspace';
import { PublicProjectDescription } from './public-project-description';
import { PublicProjectTasks } from './public-project-tasks';

function PublicProjectPage(props: {
  read: PublicProjectRead | undefined;
  name: string;
  section: ProjectSection;
  onSection(section: ProjectSection): void;
  onOpenTask(taskId: string): void;
  onRetry(): void;
}) {
  useSplitDisplayName(() => props.name);
  return (
    <Show
      when={props.read?.status !== 'unavailable'}
      fallback={<SignedOutRoute />}
    >
      <SidePanel.Root floating defaultOpen={false}>
        <div class="flex size-full min-h-0 min-w-0 flex-col overflow-hidden">
          <EntityDetailTopBar
            navigation={
              <Tabs
                aria-label="Project sections"
                touch="inset"
                class="shrink-0"
                options={[
                  { value: 'overview', label: 'Overview' },
                  { value: 'tasks', label: 'Tasks' },
                ]}
                value={props.section}
                onChange={props.onSection}
              />
            }
          >
            <LoginButton />
          </EntityDetailTopBar>
          <div class="relative min-h-0 min-w-0 flex-1 touch:[--mobile-content-inset-top:0px]">
            <Switch
              fallback={<ProjectContentSkeleton section={props.section} />}
            >
              <Match
                when={props.read?.status === 'ready' && props.read.project}
              >
                {(project) => (
                  <ProjectWorkspace
                    project={project().project}
                    properties={project().properties}
                    section={props.section}
                    description={
                      <PublicProjectDescription
                        projectId={project().project.id}
                        description={project().description}
                      />
                    }
                    discussion={
                      <p class="mt-3 text-xs text-ink-muted">
                        Sign in to view comments.
                      </p>
                    }
                    tasks={
                      <PublicProjectTasks
                        tasks={project().tasks}
                        onOpenTask={props.onOpenTask}
                      />
                    }
                  />
                )}
              </Match>
              <Match when={props.read?.status === 'failed'}>
                <EmptyStatePanel
                  centered
                  title="Could not load this project"
                  description="Check your connection and try again."
                >
                  <Button onClick={() => props.onRetry()}>Try again</Button>
                </EmptyStatePanel>
              </Match>
            </Switch>
          </div>
        </div>
      </SidePanel.Root>
    </Show>
  );
}

/**
 * A project, or one of its tasks, as a signed-out visitor reads it. Nothing
 * here can change the project, whatever access the link grants.
 */
export function PublicProjectRoute(props: {
  projectId: string;
  section: ProjectSection;
  taskId?: string;
}) {
  const navigate = useNavigate();
  const query = useQuery(() => publicProjectQueryOptions(props.projectId));
  // `data` is read only once settled, so the first load never suspends the
  // pane. Names land before any child sees the project and looks one up.
  const read = createMemo(() => {
    const current = query.isSuccess ? query.data : undefined;
    if (current?.status === 'ready')
      rememberDisplayNames(current.project.people);
    return current;
  });
  const name = () => {
    const current = read();
    return current?.status === 'ready'
      ? current.project.project.name
      : 'Project';
  };
  const openSection = (section: ProjectSection) =>
    fireAndForget(
      navigate({
        route: projectDetailRoute,
        params: { projectId: props.projectId, section },
      }),
      'projects'
    );
  const openTask = (taskId: string) =>
    fireAndForget(
      navigate({
        route: projectTaskRoute,
        params: { projectId: props.projectId, section: props.section, taskId },
      }),
      'projects'
    );
  return (
    <ViewBreadcrumbs.Root
      value={
        props.taskId ? `task:${props.taskId}` : `initiative:${props.projectId}`
      }
      onChange={(value) => {
        if (props.taskId && value === `initiative:${props.projectId}`)
          openSection(props.section);
      }}
    >
      <ViewBreadcrumbs.Item
        value={`initiative:${props.projectId}`}
        metadata={{ type: 'initiative', id: props.projectId }}
        order={1}
      >
        {(item) => (
          <ViewBreadcrumbs.Button
            class="gap-1.5"
            isActive={item.isActive()}
            onClick={item.onSelect}
            tooltip={name()}
          >
            <StackIcon class="size-3 shrink-0" />
            <span class="truncate">{name()}</span>
          </ViewBreadcrumbs.Button>
        )}
      </ViewBreadcrumbs.Item>
      <Show
        when={props.taskId}
        fallback={
          <PublicProjectPage
            read={read()}
            name={name()}
            section={props.section}
            onSection={openSection}
            onOpenTask={openTask}
            onRetry={() => fireAndForget(query.refetch(), 'projects')}
          />
        }
      >
        {(taskId) => (
          <PublicTaskDetail
            taskId={taskId()}
            breadcrumbOrder={2}
            onClose={() => openSection(props.section)}
          />
        )}
      </Show>
    </ViewBreadcrumbs.Root>
  );
}
