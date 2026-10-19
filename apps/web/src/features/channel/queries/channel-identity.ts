import { useChannel } from '@core/context/channels';
import { useUserId } from '@core/context/user';
import { createRenameDssEntityMutation } from '@entity/queries/rename';
import { Telemetry } from '@macro-inc/observability';
import { useChannelParticipantsQuery } from '@queries/channel/channel-participants';
import { usePatchChannelMutation } from '@queries/channel/channels';
import { useSetChannelPictureMutation } from '@queries/channel/picture';
import { queryReadyGate } from '@queries/gate';
import { useCurrentTeamQuery } from '@queries/team/teams';
import { ChannelType } from '@service-storage/generated/schemas/channelType';
import { ParticipantRole } from '@service-storage/generated/schemas/participantRole';
import { err, ok, ResultAsync } from 'neverthrow';
import type { Accessor } from 'solid-js';
import type {
  ChannelIdentitySaveError,
  ChannelIdentityTeamControls,
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

export function createChannelIdentityTeamControls(
  channelId: string
): Accessor<ChannelIdentityTeamControls | undefined> {
  const channel = useChannel(channelId);
  const userId = useUserId();
  const supportsTeamSettings = () => {
    const type = channel()?.channel_type;
    return (
      type === ChannelType.private ||
      type === ChannelType.public ||
      type === ChannelType.team
    );
  };
  const participants = useChannelParticipantsQuery(() =>
    supportsTeamSettings() ? channelId : ''
  );
  const canManage = () => {
    if (!queryReadyGate(participants)) return false;
    const role = participants.data.find(
      (participant) => participant.user_id === userId()
    )?.role;
    return role === ParticipantRole.owner || role === ParticipantRole.admin;
  };
  const isTeamChannel = () => channel()?.channel_type === ChannelType.team;
  const team = useCurrentTeamQuery(
    () => supportsTeamSettings() && canManage() && !isTeamChannel()
  );
  const currentTeam = () =>
    queryReadyGate(team) ? team.data?.team : undefined;
  const patch = usePatchChannelMutation();
  const save: ChannelIdentityTeamControls['save'] = (changes) =>
    Telemetry.span('channel.identity.team', async (span) => {
      span.setAttr('channel.id', channelId);
      span.setAttr('channel.identity.convert_to_team', changes.convertToTeam);
      if (changes.autoJoinTeam !== undefined) {
        span.setAttr('channel.identity.auto_join_team', changes.autoJoinTeam);
      }
      if (
        !supportsTeamSettings() ||
        !canManage() ||
        (changes.convertToTeam && !currentTeam())
      ) {
        span.error('Team settings permission changed');
        return err({ kind: 'team' as const });
      }
      const result = await ResultAsync.fromPromise(
        patch.mutateAsync({
          channelId,
          convert_to_team_channel: changes.convertToTeam || undefined,
          auto_join_team: changes.autoJoinTeam,
        }),
        (): ChannelIdentitySaveError => ({ kind: 'team' })
      );
      if (result.isErr()) span.error('Channel team settings save failed');
      return result.map(() => undefined);
    });

  return () => {
    const value = channel();
    if (!value || !supportsTeamSettings()) return;
    return {
      settings: {
        isTeamChannel: isTeamChannel(),
        autoJoinTeam: value.auto_join_team,
      },
      canManage: canManage(),
      canConvert: !isTeamChannel() && !!currentTeam(),
      conversionUnavailableReason:
        isTeamChannel() || currentTeam()
          ? undefined
          : team.isLoading
            ? 'Checking your team membership…'
            : team.isError
              ? 'Could not check your team membership. Reopen the dialog to try again.'
              : 'You need to belong to a team before converting this channel.',
      save,
    };
  };
}
