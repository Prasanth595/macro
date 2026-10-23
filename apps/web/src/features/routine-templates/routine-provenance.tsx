import { useSplitLayout } from '@components/app/split-layout/layout';
import { getDisplayName } from '@core/user/displayName';
import { tryMacroId } from '@core/user/macroId';
import { Show } from 'solid-js';
import { openActivateTemplateDialog } from './activate-template';
import type { Provenance } from './core/template';
import {
  useRoutineProvenanceQuery,
  useRoutineTemplateQuery,
} from './queries/templates';
import { createTemplateLabels } from './template-labels';
import { TemplateProvenanceView } from './views/template-provenance';

/** Where an activated routine came from, on the routine's own page. */
export function RoutineProvenance(props: { scheduleId: string }) {
  const query = useRoutineProvenanceQuery(
    () => props.scheduleId,
    () => true
  );
  return (
    <Show when={query.isSuccess && query.data}>
      {(provenance) => (
        <ConnectedProvenance
          scheduleId={props.scheduleId}
          provenance={provenance()}
        />
      )}
    </Show>
  );
}

function ConnectedProvenance(props: {
  scheduleId: string;
  provenance: Provenance;
}) {
  const layout = useSplitLayout();
  const label = createTemplateLabels();
  const template = useRoutineTemplateQuery(() => props.provenance.templateId);
  const change = (fill: boolean) => {
    if (!template.isSuccess) return;
    openActivateTemplateDialog({
      template: template.data,
      mode: {
        kind: 'rebind',
        scheduleId: props.scheduleId,
        bindings: props.provenance.bindings,
        fill,
      },
      layout,
    });
  };
  return (
    <TemplateProvenanceView
      provenance={props.provenance}
      ownerName={
        getDisplayName(tryMacroId(props.provenance.template?.ownerId ?? '')) ||
        'a teammate'
      }
      label={label}
      onView={() =>
        layout.openWithSplit({
          type: 'routine-template',
          id: props.provenance.templateId,
        })
      }
      onChange={() => change(false)}
      onFillAgain={() => change(true)}
    />
  );
}
