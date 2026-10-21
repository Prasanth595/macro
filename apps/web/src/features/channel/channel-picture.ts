import {
  IMAGE_MIME_TYPES,
  imageFileError,
} from '@app/components/image-editor/image-file';
import { toast } from '@core/component/Toast/Toast';
import { createStaticFile } from '@core/util/create';
import { openFilePicker } from '@core/util/upload';
import {
  useChannelPicture,
  useSetChannelPictureMutation,
} from '@queries/channel/picture';
import type { Accessor } from 'solid-js';

/**
 * Upload and clear channel pictures, for menus that learn their channel when
 * the user acts rather than when the menu is built. Callers own the permission
 * check; `canEditChannelIdentity` is the rule the server enforces.
 */
export function useChannelPictureEditor() {
  const mutation = useSetChannelPictureMutation(createStaticFile);

  const save = async (channelId: string, file: File | null) => {
    if (mutation.isPending) return;
    const validationError = file ? imageFileError(file) : undefined;
    if (validationError) {
      toast.failure(validationError);
      return;
    }
    try {
      await mutation.mutateAsync({ channelId, file });
      toast.success(
        file ? 'Channel picture updated' : 'Channel picture removed'
      );
    } catch {
      toast.failure('Could not update channel picture. Please try again.');
    }
  };

  const pickFile = (channelId: string) => {
    if (mutation.isPending) return;
    openFilePicker(
      {
        acceptedMimeTypes: IMAGE_MIME_TYPES,
        acceptedFileExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      },
      async (files) => {
        if (files[0]) await save(channelId, files[0]);
      }
    );
  };

  return {
    isPending: () => mutation.isPending,
    pickFile,
    remove: (channelId: string) => void save(channelId, null),
  };
}

export function useChannelPictureActions(options: {
  channelId: Accessor<string>;
  canEdit: Accessor<boolean>;
}) {
  const picture = useChannelPicture(options.channelId);
  const editor = useChannelPictureEditor();

  const isAvailable = () =>
    options.canEdit() && !editor.isPending() && !picture.isLoading();

  return {
    hasPicture: () => !!picture.url(),
    isAvailable,
    pickFile: () => {
      if (isAvailable()) editor.pickFile(options.channelId());
    },
    remove: () => {
      if (isAvailable()) editor.remove(options.channelId());
    },
  };
}
