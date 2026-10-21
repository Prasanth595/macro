import { Telemetry } from '@macro-inc/observability';
import { err, ok, type Result, ResultAsync } from 'neverthrow';
import { imageFileError } from '../../image-editor/core/image-file';
import type { ProfilePictureWriter } from '../core/profile-picture';

export function createProfilePictureWriter(options: {
  userId: string;
  isCurrentUser: () => boolean;
  upload: (file: File) => Promise<string>;
  pictureUrl: (id: string) => string;
  update: (url: string) => Promise<Result<unknown, unknown>>;
  onSaved: (url: string | undefined) => void;
}): ProfilePictureWriter {
  let uploaded: { file: File; url: string } | undefined;
  return async (file) => {
    if (!options.isCurrentUser())
      return err('Your account changed. Reopen Settings to try again.');
    if (file) {
      const error = imageFileError(file);
      if (error) return err(error);
    }
    let url = '';
    if (file) {
      if (uploaded?.file !== file) {
        const result = await Telemetry.span(
          'profile.picture.upload',
          async (span) => {
            span.setAttr('user.id', options.userId);
            span.setAttr('image.input_bytes', file.size);
            const result = await ResultAsync.fromPromise(
              options.upload(file),
              () => 'Could not upload your profile picture. Try again.'
            );
            if (result.isErr()) span.error('Profile picture upload failed');
            return result;
          }
        );
        if (result.isErr()) return err(result.error);
        uploaded = { file, url: options.pictureUrl(result.value) };
      }
      url = uploaded.url;
    }
    if (!options.isCurrentUser())
      return err('Your account changed. Reopen Settings to try again.');
    const result = await Telemetry.span(
      'profile.picture.update',
      async (span) => {
        span.setAttr('user.id', options.userId);
        const result = await ResultAsync.fromPromise(
          options.update(url),
          () => undefined
        );
        if (result.isErr() || result.value.isErr()) {
          span.error('Profile picture update failed');
          return err('Could not save your profile picture. Try again.');
        }
        return ok(undefined);
      }
    );
    if (result.isErr()) return result;
    if (options.isCurrentUser()) options.onSaved(url || undefined);
    return ok(undefined);
  };
}
