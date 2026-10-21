import { ImageEditor } from '@app/components/image-editor/image-editor';
import { useChannelIdentityContext } from '../context/channel-identity-context';

export function ChannelIdentityImageEditor() {
  const context = useChannelIdentityContext();
  const { form } = context;

  return (
    <ImageEditor
      source={context.cropSource()}
      pictureUrl={context.pictureUrl()}
      fileName={context.imageFileName()}
      disabled={
        !context.canEdit() || form.pending() || context.pictureLoading()
      }
      saveDisabled={!form.values.name.trim() || !form.canSaveTeam()}
      canSave={form.canSave()}
      hasImageDraft={form.values.picture instanceof File}
      error={form.error()}
      preview={context.preview}
      telemetryAttributes={{ 'channel.id': context.channelId }}
      outputFileName="channel-picture.png"
      onSelect={context.selectPicture}
      onClear={context.clearPicture}
      onSave={context.saveImage}
      onCancel={context.returnToDetails}
    />
  );
}
