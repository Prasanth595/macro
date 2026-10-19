import { ok } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChannelIdentityTeamControls } from './channel-identity';

const state = vi.hoisted(() => ({
  channelType: 'private',
  autoJoin: false,
  role: 'owner',
  participantsPending: false,
  teamPending: false,
  hasTeam: true,
  patch: vi.fn(),
  teamQuery: vi.fn(),
}));

vi.mock('@core/context/channels', () => ({
  useChannel: () => () => ({
    channel_type: state.channelType,
    auto_join_team: state.autoJoin,
  }),
}));
vi.mock('@core/context/user', () => ({
  useUserId: () => () => 'current-user',
}));
vi.mock('@entity/queries/rename', () => ({
  createRenameDssEntityMutation: vi.fn(),
}));
vi.mock('@queries/channel/picture', () => ({
  useSetChannelPictureMutation: vi.fn(),
}));
vi.mock('@queries/channel/channels', () => ({
  usePatchChannelMutation: () => ({ mutateAsync: state.patch }),
}));
vi.mock('@queries/channel/channel-participants', () => ({
  useChannelParticipantsQuery: () => ({
    get isPending() {
      return state.participantsPending;
    },
    get data() {
      if (state.participantsPending)
        throw new Error('Read pending participants');
      return [{ user_id: 'current-user', role: state.role }];
    },
  }),
}));
vi.mock('@queries/team/teams', () => ({
  useCurrentTeamQuery: (enabled: () => boolean) => {
    state.teamQuery(enabled);
    return {
      get isPending() {
        return state.teamPending;
      },
      get isLoading() {
        return state.teamPending;
      },
      isError: false,
      get data() {
        if (state.teamPending) throw new Error('Read pending team');
        return state.hasTeam ? { team: { id: 'team-id' } } : null;
      },
    };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.channelType = 'private';
  state.autoJoin = false;
  state.role = 'owner';
  state.participantsPending = false;
  state.teamPending = false;
  state.hasTeam = true;
  state.patch.mockResolvedValue(ok(undefined));
});

describe('channel identity team controls', () => {
  it('guards pending metadata reads and disables conversion without team membership', () => {
    state.participantsPending = true;
    state.teamPending = true;
    const controls = createChannelIdentityTeamControls('design');
    expect(controls()?.canManage).toBe(false);
    expect(controls()?.canConvert).toBe(false);
    state.participantsPending = false;
    expect(controls()?.canManage).toBe(true);
    expect(controls()?.conversionUnavailableReason).toContain('Checking');
    state.teamPending = false;
    state.hasTeam = false;
    expect(controls()?.canConvert).toBe(false);
    expect(controls()?.conversionUnavailableReason).toContain(
      'belong to a team'
    );
  });

  it('patches conversion and auto-join together without resubmitting the name', async () => {
    const controls = createChannelIdentityTeamControls('design');
    expect(controls()?.canConvert).toBe(true);
    const result = await controls()?.save({
      convertToTeam: true,
      autoJoinTeam: true,
    });
    expect(result?.isOk()).toBe(true);
    expect(state.patch).toHaveBeenCalledExactlyOnceWith({
      channelId: 'design',
      convert_to_team_channel: true,
      auto_join_team: true,
    });
  });

  it('blocks member writes and rechecks team membership before conversion', async () => {
    const controls = createChannelIdentityTeamControls('design');
    state.role = 'member';
    expect(controls()?.canManage).toBe(false);
    expect((await controls()?.save({ convertToTeam: true }))?.isErr()).toBe(
      true
    );
    state.role = 'admin';
    state.hasTeam = false;
    expect((await controls()?.save({ convertToTeam: true }))?.isErr()).toBe(
      true
    );
    expect(state.patch).not.toHaveBeenCalled();
    const previous = controls();
    state.channelType = 'direct_message';
    expect(controls()).toBeUndefined();
    expect(
      (
        await previous?.save({ convertToTeam: false, autoJoinTeam: true })
      )?.isErr()
    ).toBe(true);
    expect(state.patch).not.toHaveBeenCalled();
  });

  it('updates an existing team channel without requiring the user to join a team', async () => {
    state.channelType = 'team';
    state.hasTeam = false;
    const controls = createChannelIdentityTeamControls('design');
    expect(state.teamQuery.mock.calls[0][0]()).toBe(false);
    expect(controls()?.canConvert).toBe(false);
    const result = await controls()?.save({
      convertToTeam: false,
      autoJoinTeam: true,
    });
    expect(result?.isOk()).toBe(true);
    expect(state.patch).toHaveBeenCalledExactlyOnceWith({
      channelId: 'design',
      convert_to_team_channel: undefined,
      auto_join_team: true,
    });
  });
});
