import { ForwardToChannel } from '@core/component/ForwardToChannel';
import type { TemplateDraft } from '@service-scheduled-action/generated/schemas';
import { type ManagedDialogProps, openDialog } from '@ui';
import { extractTemplate, saveTemplate } from './queries/templates';
import { createTemplateLabels } from './template-labels';
import { ShareTemplateDialog } from './views/share-template-dialog';

type Props = ManagedDialogProps & { routineId: string; routineName: string };

function ConnectedShareDialog(props: Props) {
  const label = createTemplateLabels();
  // The extracted wire draft; edits apply to it so nothing unseen is lost.
  let draft: TemplateDraft | undefined;
  return (
    <ShareTemplateDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      routineName={props.routineName}
      label={label}
      load={async () => {
        const extracted = await extractTemplate(props.routineId);
        draft = extracted.draft;
        return extracted.share;
      }}
      save={async (edits, existingTemplateId) => {
        if (!draft) throw new Error('Prepare the template again.');
        return saveTemplate({
          sourceActionId: props.routineId,
          draft,
          edits,
          existingTemplateId,
        });
      }}
      Send={(send) => (
        <div class="p-1">
          <ForwardToChannel
            entity={{
              entity_type: 'routine_template',
              entity_id: send.templateId,
            }}
            name={send.name}
            hideAccessLevelSelector
            submitPermissionInfo={undefined}
            onSubmit={send.onSent}
            onCancel={send.onSent}
          />
        </div>
      )}
    />
  );
}

/** Share a routine the caller owns as a template. */
export function openShareTemplateDialog(input: {
  routineId: string;
  routineName: string;
}) {
  return openDialog(ConnectedShareDialog, input, {
    key: `share-routine-template:${input.routineId}`,
  });
}
