import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { err, ok } from 'neverthrow';
import type { JSX } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useSetAvailabilityCalendarMutation,
  useSetTeamCalendarSharingMutation,
} from '../team';
import { calendarTeamKeys } from '../team-keys';

const setTeamCalendarSharing = vi.hoisted(() => vi.fn());
const setAvailabilityCalendar = vi.hoisted(() => vi.fn());

vi.mock('@service-email/client', () => ({
  emailClient: { setTeamCalendarSharing, setAvailabilityCalendar },
}));
vi.mock('@service-auth/client', () => ({ authServiceClient: {} }));

let testQueryClient: QueryClient;

vi.mock('../../client', () => ({
  get queryClient() {
    return testQueryClient;
  },
}));

const identity = { userId: 'alice', teamId: 'team-a' };
const sharingKey = calendarTeamKeys.sharing(identity).queryKey;
const calendarsKey = calendarTeamKeys.availabilityCalendars(identity).queryKey;

let dispose: (() => void) | undefined;

function renderHook<T>(factory: () => T): T {
  let hook!: T;
  dispose = render(
    () => (
      <QueryClientProvider client={testQueryClient}>
        {(() => {
          hook = factory();
          return null as unknown as JSX.Element;
        })()}
      </QueryClientProvider>
    ),
    document.body
  );
  return hook;
}

const failure = () => err([{ code: 'HTTP_ERROR' as const, message: 'no' }]);

beforeEach(() => {
  vi.clearAllMocks();
  testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  testQueryClient.clear();
});

describe('team calendar query boundaries', () => {
  it('partitions every policy query by viewer and team', () => {
    const otherUser = { ...identity, userId: 'bob' };
    const otherTeam = { ...identity, teamId: 'team-b' };
    for (const key of [
      calendarTeamKeys.sharing,
      calendarTeamKeys.availabilityCalendars,
    ]) {
      expect(key(identity).queryKey).not.toEqual(key(otherUser).queryKey);
      expect(key(identity).queryKey).not.toEqual(key(otherTeam).queryKey);
    }
  });
});

describe('team sharing changes', () => {
  it('shows the new choice while saving and never clears the setting', async () => {
    testQueryClient.setQueryData(sharingKey, { sharing: 'busy_only' });
    let resolve!: (value: unknown) => void;
    setTeamCalendarSharing.mockReturnValue(
      new Promise((res) => {
        resolve = res;
      })
    );
    const mutation = renderHook(() => useSetTeamCalendarSharingMutation());

    const saving = mutation.mutateAsync({ identity, sharing: 'all' });
    await vi.waitFor(() =>
      expect(testQueryClient.getQueryData(sharingKey)).toEqual({
        sharing: 'all',
      })
    );
    resolve(ok({ sharing: 'all' }));
    await saving;

    expect(setTeamCalendarSharing).toHaveBeenCalledWith({ sharing: 'all' });
    expect(testQueryClient.getQueryData(sharingKey)).toEqual({
      sharing: 'all',
    });
  });

  it('restores the saved choice when the change fails', async () => {
    testQueryClient.setQueryData(sharingKey, { sharing: 'busy_only' });
    setTeamCalendarSharing.mockResolvedValue(failure());
    const mutation = renderHook(() => useSetTeamCalendarSharingMutation());

    await expect(
      mutation.mutateAsync({ identity, sharing: 'none' })
    ).rejects.toBeDefined();

    expect(testQueryClient.getQueryData(sharingKey)).toEqual({
      sharing: 'busy_only',
    });
  });
});

describe('availability calendar changes', () => {
  const calendars = {
    calendars: [
      {
        calendarId: 'primary',
        name: 'Primary',
        isPrimary: true,
        contributesToAvailability: true,
      },
      {
        calendarId: 'holidays',
        name: 'Holidays',
        isPrimary: false,
        contributesToAvailability: false,
      },
      {
        calendarId: 'other-account',
        name: 'Other account',
        isPrimary: true,
        contributesToAvailability: true,
      },
    ],
  };
  const included = () =>
    (
      testQueryClient.getQueryData(calendarsKey) as typeof calendars
    ).calendars.map((calendar) => calendar.contributesToAvailability);

  it('saves an account group in one step and updates only its calendars', async () => {
    testQueryClient.setQueryData(calendarsKey, calendars);
    setAvailabilityCalendar.mockResolvedValue(ok({}));
    const mutation = renderHook(() => useSetAvailabilityCalendarMutation());

    await mutation.mutateAsync({
      identity,
      calendarIds: ['primary', 'holidays'],
      contributesToAvailability: false,
    });

    expect(setAvailabilityCalendar).toHaveBeenCalledTimes(2);
    expect(setAvailabilityCalendar).toHaveBeenCalledWith('holidays', {
      contributesToAvailability: false,
    });
    expect(included()).toEqual([false, false, true]);
  });

  it('restores every calendar when part of a group change fails', async () => {
    testQueryClient.setQueryData(calendarsKey, calendars);
    setAvailabilityCalendar
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(failure());
    const mutation = renderHook(() => useSetAvailabilityCalendarMutation());

    await expect(
      mutation.mutateAsync({
        identity,
        calendarIds: ['primary', 'holidays'],
        contributesToAvailability: true,
      })
    ).rejects.toBeDefined();

    expect(included()).toEqual([true, false, true]);
  });
});
