import { openAgentsPage } from '@app/features/agents-view/primitives/open-page';
import { useFeatureFlag } from '@app/lib/analytics/posthog';
import { useSplitLayout } from '@components/app/split-layout/layout';
import { useSplitPanelOrThrow } from '@components/app/split-layout/layoutUtils';
import { toast } from '@core/component/Toast/Toast';
import { enableRoutineTemplates } from '@core/constant/featureFlags';
import { useUserId } from '@core/context/user';
import { getDisplayName } from '@core/user/displayName';
import { tryMacroId } from '@core/user/macroId';
import { fireAndForget } from '@core/util/fireAndForget';
import { confirmDialog } from '@ui';
import { createEffect, Match, Switch } from 'solid-js';
import { openActivateTemplateDialog } from './activate-template';
import {
  useDeleteTemplateMutation,
  useRoutineTemplateQuery,
} from './queries/templates';
import { createTemplateLabels } from './template-labels';
import { TemplatePage } from './views/template-page';

/** The template page, wired to the template query and the split layout. */
export function RoutineTemplatePage(props: { templateId: string }) {
  const flag = useFeatureFlag(enableRoutineTemplates);
  const layout = useSplitLayout();
  const panel = useSplitPanelOrThrow();
  const userId = useUserId();
  const label = createTemplateLabels();
  const query = useRoutineTemplateQuery(() => props.templateId);
  const remove = useDeleteTemplateMutation();
  const template = () => (query.isSuccess ? query.data : undefined);

  createEffect(() => {
    const name = template()?.name;
    if (name) panel.handle.setDisplayName(name);
  });

  async function deleteTemplate() {
    const current = template();
    if (!current) return;
    const confirmed = await confirmDialog({
      title: 'Delete template?',
      body: 'People can no longer view or activate it. Routines already activated from it keep running.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    await remove.mutateAsync(current.id);
    toast.success('Template deleted');
    openAgentsPage(layout, 'routines');
  }

  return (
    <Switch
      fallback={
        <p class="flex size-full items-center justify-center p-3 text-sm text-ink-muted">
          Loading…
        </p>
      }
    >
      <Match when={!flag().loading && !flag().enabled}>
        <p class="flex size-full items-center justify-center p-3 text-sm text-ink-muted">
          Routine templates aren't available yet.
        </p>
      </Match>
      <Match when={template()}>
        {(current) => (
          <TemplatePage
            template={current()}
            ownerName={
              getDisplayName(tryMacroId(current().ownerId)) || 'a teammate'
            }
            isOwner={current().ownerId === userId()}
            label={label}
            onActivate={() =>
              openActivateTemplateDialog({
                template: current(),
                mode: { kind: 'activate' },
                layout,
              })
            }
            onOpenRoutine={(id) =>
              openAgentsPage(layout, 'routines', { routineId: id })
            }
            onDelete={() =>
              fireAndForget(deleteTemplate(), 'routine-templates')
            }
          />
        )}
      </Match>
      <Match when={query.isError}>
        <p class="flex size-full items-center justify-center p-3 text-sm text-ink-muted">
          This template doesn't exist or isn't shared with you.
        </p>
      </Match>
    </Switch>
  );
}
