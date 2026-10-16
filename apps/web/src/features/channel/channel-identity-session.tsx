import { createStaticFile } from '@core/util/create';
import {
  useChannelPicture,
  useChannelPictureFileName,
} from '@queries/channel/picture';
import { Show } from 'solid-js';
import type { ChannelIdentityProps } from './channel-identity';
import { createChannelIdentityWriter } from './queries/channel-identity';
import {
  ChannelIdentityCard,
  ChannelIdentityModal,
} from './views/channel-identity-editor';

export default function ChannelIdentitySession(
  props: ChannelIdentityProps & {
    onClose: () => void;
    dialog?: boolean;
  }
) {
  const picture = useChannelPicture(() => props.channelId);
  const fileName = useChannelPictureFileName(picture.pictureId);
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
    get channelId() {
      return props.channelId;
    },
    get fileName() {
      return fileName();
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

  return (
    <Show
      when={props.dialog}
      fallback={<ChannelIdentityCard {...editorProps} />}
    >
      <ChannelIdentityModal {...editorProps} />
    </Show>
  );
}
