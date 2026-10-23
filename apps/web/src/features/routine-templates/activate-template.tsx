import { openAgentsPage } from '@app/features/agents-view/primitives/open-page';
import type { SplitManager } from '@components/app/split-layout/layoutManager';
import { toast } from '@core/component/Toast/Toast';
import { getDisplayName } from '@core/user/displayName';
import { tryMacroId } from '@core/user/macroId';
import { type ManagedDialogProps, openDialog } from '@ui';
import type { Bindings, RoutineTemplate } from './core/template';
import {
  fillTemplate,
  useActivateTemplateMutation,
  useRebindRoutineMutation,
} from './queries/templates';
import { createTemplateLabels } from './template-labels';
import { TemplateValuePicker } from './value-picker';
import { ActivateTemplateDialog } from './views/activate-template-dialog';

type Mode =
  | { kind: 'activate' }
  /** Change the values of a routine activated from this template. */
  | { kind: 'rebind'; scheduleId: string; bindings: Bindings; fill: boolean };

type Props = ManagedDialogProps & {
  template: RoutineTemplate;
  mode: Mode;
  layout: Pick<SplitManager, 'openWithSplit'>;
};

function ConnectedActivateDialog(props: Props) {
  const label = createTemplateLabels();
  const activate = useActivateTemplateMutation();
  const rebind = useRebindRoutineMutation();
  const rebinding = () => props.mode.kind === 'rebind';

  async function submit(bindings: Bindings, name: string | undefined) {
    const mode = props.mode;
    if (mode.kind === 'rebind') {
      await rebind.mutateAsync({ scheduleId: mode.scheduleId, bindings });
      toast.success('Routine updated');
      return;
    }
    const routine = await activate.mutateAsync({
      templateId: props.template.id,
      bindings,
      name,
    });
    toast.success('Routine activated');
    if (routine.id)
      openAgentsPage(props.layout, 'routines', { routineId: routine.id });
  }

  return (
    <ActivateTemplateDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      template={props.template}
      ownerName={
        getDisplayName(tryMacroId(props.template.ownerId)) || 'a teammate'
      }
      label={label}
      initial={props.mode.kind === 'rebind' ? props.mode.bindings : undefined}
      fillOnOpen={props.mode.kind === 'activate' || props.mode.fill}
      title={rebinding() ? 'Change values:' : 'Activate for me:'}
      submitLabel={rebinding() ? 'Save' : 'Activate'}
      fill={(instruction, current) =>
        fillTemplate({ templateId: props.template.id, instruction, current })
      }
      submit={submit}
      Picker={TemplateValuePicker}
    />
  );
}

/** Review and activate a template, or change an activated routine's values. */
export function openActivateTemplateDialog(
  input: Omit<Props, keyof ManagedDialogProps>
) {
  return openDialog(ConnectedActivateDialog, input, {
    key: `routine-template:${input.template.id}`,
  });
}
