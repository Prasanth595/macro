import { staticFileIdEndpoint } from '@core/constant/servers';
import { useUserId } from '@core/context/user';
import { useProfilePictureUrl } from '@core/signal/profilePicture';
import { createStaticFile } from '@core/util/create';
import { authServiceClient } from '@service-auth/client';
import { createProfilePictureWriter } from './profile-picture';

export function useProfilePictureEditorSource(userId: string) {
  const currentUserId = useUserId();
  const [pictureUrl, controls] = useProfilePictureUrl(userId);
  return {
    pictureUrl,
    writer: createProfilePictureWriter({
      userId,
      isCurrentUser: () => currentUserId() === userId,
      upload: createStaticFile,
      pictureUrl: staticFileIdEndpoint,
      update: (url) => authServiceClient.putProfilePicture({ url }),
      onSaved: (url) =>
        controls.mutate({
          _createdAt: new Date(),
          id: userId,
          url,
          loading: false,
        }),
    }),
  };
}
