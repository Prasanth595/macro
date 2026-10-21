import { staticFileIdEndpoint } from '@core/constant/servers';
import { createStaticFile } from '@core/util/create';
import {
  useChannelPicture,
  useChannelPictureFileName,
} from '@queries/channel/picture';
import type { ManagedDialogProps } from '@ui/components/ImperativeDialog';
import type { ChannelIdentityProps } from './channel-identity';
import {
  createChannelIdentityTeamControls,
  createChannelIdentityWriter,
} from './queries/channel-identity';
import { ChannelIdentityModal } from './views/channel-identity-editor';

export default function ChannelIdentitySession(
  props: ChannelIdentityProps & ManagedDialogProps
) {
  const picture = useChannelPicture(() => props.channelId);
  const pictureFileName = useChannelPictureFileName(picture.pictureId);
  const teamControls = createChannelIdentityTeamControls(props.channelId);
  const writer = createChannelIdentityWriter({
    channelId: props.channelId,
    name: props.name,
    upload: createStaticFile,
  });
  const editorProps = {
    get name() {
      return props.name;
    },
    get pictureUrl() {
      return picture.largeUrl();
    },
    get pictureSourceUrl() {
      const id = picture.pictureId();
      return id ? staticFileIdEndpoint(id) : undefined;
    },
    get pictureFileName() {
      return pictureFileName();
    },
    get channelId() {
      return props.channelId;
    },
    get pictureLoading() {
      return picture.isLoading();
    },
    get canEdit() {
      return props.canEdit;
    },
    writer,
    teamControls,
    get open() {
      return props.open;
    },
    onOpenChange: props.onOpenChange,
  };

  return <ChannelIdentityModal {...editorProps} />;
}
