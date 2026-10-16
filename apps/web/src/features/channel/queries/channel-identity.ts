import { createRenameDssEntityMutation } from '@entity/queries/rename';
import { Telemetry } from '@macro-inc/observability';
import { useSetChannelPictureMutation } from '@queries/channel/picture';
import { err, ok, ResultAsync } from 'neverthrow';
import type {
  ChannelIdentitySaveError,
  ChannelIdentityWriter,
} from '../core/channel-identity';

export function createChannelIdentityWriter(options: {
  channelId: string;
  name: string;
  upload: (file: File) => Promise<string>;
}): ChannelIdentityWriter {
  const picture = useSetChannelPictureMutation(options.upload);
  const rename = createRenameDssEntityMutation();

  return {
    savePicture: (file) =>
      Telemetry.span('channel.identity.picture', async (span) => {
        span.setAttr('channel.id', options.channelId);
        const result = await ResultAsync.fromPromise(
          picture.mutateAsync({ channelId: options.channelId, file }),
          (): ChannelIdentitySaveError => ({ kind: 'picture' })
        );
        if (result.isErr()) span.error('Channel picture save failed');
        return result.map(() => undefined);
      }),
    saveName: (newName) =>
      Telemetry.span('channel.identity.name', async (span) => {
        span.setAttr('channel.id', options.channelId);
        const result = await ResultAsync.fromPromise(
          rename.mutateAsync({
            entity: {
              id: options.channelId,
              type: 'channel',
              name: options.name,
            },
            newName,
          }),
          (): ChannelIdentitySaveError => ({ kind: 'name' })
        );
        const saved = result.andThen((value) =>
          value.success
            ? ok(undefined)
            : err<never, ChannelIdentitySaveError>({ kind: 'name' })
        );
        if (saved.isErr()) span.error('Channel name save failed');
        return saved;
      }),
  };
}
