/**
 * @vitest-environment jsdom
 */

import { ThrownResultError } from '@core/util/result';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamInviteLinkAcceptance } from './TeamInviteLinkAcceptance';

const state = vi.hoisted(() => ({
  team: undefined as { team_id: string; team_name: string } | undefined,
  teamError: false,
  joinError: undefined as unknown,
  join: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@core/component/Toast/Toast', () => ({
  toast: { success: vi.fn(), failure: vi.fn() },
}));
vi.mock('@solidjs/router', () => ({ useNavigate: () => state.navigate }));
vi.mock('@queries/team/invite-link', () => ({
  useTeamByInviteLinkQuery: () => ({
    get isPending() {
      return !state.team && !state.teamError;
    },
    get isSuccess() {
      return !!state.team;
    },
    get isError() {
      return state.teamError;
    },
    get data() {
      return state.team;
    },
  }),
  useJoinTeamByInviteLinkMutation: () => ({
    isPending: false,
    get isError() {
      return state.joinError !== undefined;
    },
    get error() {
      return state.joinError;
    },
    mutate: state.join,
  }),
}));

beforeEach(() => {
  state.team = undefined;
  state.teamError = false;
  state.joinError = undefined;
  state.join.mockReset();
});

afterEach(cleanup);

describe('TeamInviteLinkAcceptance', () => {
  it('names the team and joins it with the link token', () => {
    state.team = { team_id: 'team-1', team_name: 'Acme' };
    render(() => <TeamInviteLinkAcceptance token="abc-123" />);

    expect(screen.getByRole('heading', { name: 'Join Acme' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Join Team' }));

    expect(state.join).toHaveBeenCalledWith({ token: 'abc-123' });
  });

  it('explains a link that was reset or turned off', () => {
    state.teamError = true;
    render(() => <TeamInviteLinkAcceptance token="abc-123" />);

    expect(
      screen.getByRole('heading', { name: 'Invite Link Not Valid' })
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Join Team' })).toBeNull();
  });

  it('tells users on another team to leave it first', () => {
    state.team = { team_id: 'team-1', team_name: 'Acme' };
    state.joinError = new ThrownResultError([
      { code: 'CONFLICT', message: 'Resource conflict' },
    ]);
    render(() => <TeamInviteLinkAcceptance token="abc-123" />);

    expect(
      screen.getByRole('heading', { name: 'Already on Another Team' })
    ).toBeTruthy();
  });
});
