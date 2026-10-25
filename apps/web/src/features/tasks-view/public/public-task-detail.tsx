import { EntityDetailBreadcrumbSkeleton } from '@app/components/entity-detail/EntityDetailBreadcrumbSkeleton';
import type { EntityDetailTarget } from '@app/components/entity-detail/entity-detail-target';
import { ViewBreadcrumbs, ViewShell } from '@app/components/view-shell';
import { MarkdownDetailBreadcrumbItem } from '@block-md/component/MarkdownDetailBreadcrumbItem';
import { SidePanel } from '@components/app/side-panel';
import { LoginButton } from '@core/component/TopBar/LoginButton';
import { TaskDetail } from '../components/TaskDetail';

/**
 * A task as a signed-out visitor reads it: the shared document detail, which
 * follows the visitor's access, with Login where members have Share.
 */
export function PublicTaskDetail(props: {
  taskId: string;
  breadcrumbOrder: number;
  onClose(): void;
}) {
  const metadata = (): EntityDetailTarget => ({
    type: 'document',
    id: props.taskId,
    fileType: 'md',
    subType: { type: 'task' },
  });
  return (
    <SidePanel.Root floating>
      <div class="flex size-full min-h-0 min-w-0 flex-col overflow-hidden">
        <ViewShell.TopBar class="touch:flex">
          <ViewBreadcrumbs.Outlet
            aria-label="Task location"
            fallback={<EntityDetailBreadcrumbSkeleton />}
          />
          <div class="ml-auto flex shrink-0 items-center gap-1">
            <SidePanel.HeaderActionsOutlet />
            <LoginButton />
            <SidePanel.Toggle />
          </div>
        </ViewShell.TopBar>
        <div class="relative min-h-0 min-w-0 flex-1">
          <TaskDetail task={{ id: props.taskId }}>
            {(context) => (
              <MarkdownDetailBreadcrumbItem
                value={`task:${props.taskId}`}
                metadata={metadata()}
                order={props.breadcrumbOrder}
                documentId={props.taskId}
                kind="task"
                ownerId={context.data.metadata.owner}
                projectId={context.data.metadata.projectId ?? undefined}
                onClose={props.onClose}
                onDuplicate={() => {}}
              />
            )}
          </TaskDetail>
        </div>
      </div>
    </SidePanel.Root>
  );
}
