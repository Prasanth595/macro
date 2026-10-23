import { openAgentsPage } from '@app/features/agents-view/primitives/open-page';
import { useSplitLayout } from '@components/app/split-layout/layout';
import { getDisplayName } from '@core/user/displayName';
import { tryMacroId } from '@core/user/macroId';
import { Match, Switch } from 'solid-js';
import { openActivateTemplateDialog } from './activate-template';
import { TemplateCard } from './components/template-card';
import { useRoutineTemplateQuery } from './queries/templates';
import { createTemplateLabels } from './template-labels';

/** A routine template attached to a channel message. */
export function RoutineTemplateAttachment(props: { id: string }) {
  const layout = useSplitLayout();
  const label = createTemplateLabels();
  const query = useRoutineTemplateQuery(() => props.id);
  const template = () => (query.isSuccess ? query.data : undefined);
  return (
    <Switch
      fallback={
        <div class="h-40 w-full max-w-120 animate-pulse rounded-xl border border-edge-muted bg-panel" />
      }
    >
      <Match when={template()}>
        {(current) => (
          <TemplateCard
            template={current()}
            ownerName={
              getDisplayName(tryMacroId(current().ownerId)) || 'a teammate'
            }
            label={label}
            onView={() =>
              layout.openWithSplit({ type: 'routine-template', id: props.id })
            }
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
          />
        )}
      </Match>
      <Match when={query.isError}>
        <div class="flex h-16 w-full max-w-120 items-center rounded-xl border border-edge-muted px-3.5 text-sm text-ink-muted">
          This routine template was deleted or isn't shared with you.
        </div>
      </Match>
    </Switch>
  );
}
