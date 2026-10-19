import { staticFileIdEndpoint } from '@core/constant/servers';
import { createStaticFile } from '@core/util/create';
import { useChannelPicture } from '@queries/channel/picture';
import type { ChannelIdentityProps } from './channel-identity';
import { createChannelIdentityWriter } from './queries/channel-identity';
import { ChannelIdentityModal } from './views/channel-identity-editor';

export default function ChannelIdentitySession(
  props: ChannelIdentityProps & {
    onClose: () => void;
  }
) {
  const picture = useChannelPicture(() => props.channelId);
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
    onClose: props.onClose,
  };

  return <ChannelIdentityModal {...editorProps} />;
}
