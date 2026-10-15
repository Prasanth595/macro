import type { CalendarSharing } from '@app/features/calendar-team/core/model';
import { throwOnErr } from '@core/util/result';
import { authServiceClient } from '@service-auth/client';
import type { AvailabilityCalendarsResponse } from '@service-calendar/generated/schemas/availabilityCalendarsResponse';
import type { TeamCalendarSharingBody } from '@service-calendar/generated/schemas/teamCalendarSharingBody';
import { emailClient } from '@service-email/client';
import { type QueryKey, useMutation, useQuery } from '@tanstack/solid-query';
import type { Accessor } from 'solid-js';
import { queryClient } from '../client';
import { ensureTeamCalendarExpiry } from './team-cache';
import { type CalendarTeamIdentity, calendarTeamKeys } from './team-keys';

const REFRESH_INTERVAL = 30_000;
const freshness = {
  staleTime: 0,
  gcTime: 0,
  refetchInterval: REFRESH_INTERVAL,
  refetchOnWindowFocus: true,
  refetchOnReconnect: 'always' as const,
};

/** A viewer-scoped roster read avoids the legacy current-team singleton cache. */
export function useCalendarTeamIdentityQuery(
  userId: Accessor<string | undefined>,
  enabled: Accessor<boolean>
) {
  ensureTeamCalendarExpiry();
  return useQuery(() => ({
    queryKey: calendarTeamKeys.identity(userId() ?? '').queryKey,
    queryFn: () => throwOnErr(() => authServiceClient.getTeam()),
    enabled: Boolean(userId()) && enabled(),
    ...freshness,
  }));
}

export function useTeamCalendarSharingQuery(
  identity: Accessor<CalendarTeamIdentity | undefined>
) {
  return useQuery(() => ({
    queryKey: calendarTeamKeys.sharing(identity()).queryKey,
    queryFn: ({ signal }) =>
      throwOnErr(() => emailClient.getTeamCalendarSharing(signal)),
    enabled: identity() !== undefined,
    ...freshness,
  }));
}

export function useAvailabilityCalendarsQuery(
  identity: Accessor<CalendarTeamIdentity | undefined>
) {
  return useQuery(() => ({
    queryKey: calendarTeamKeys.availabilityCalendars(identity()).queryKey,
    queryFn: ({ signal }) =>
      throwOnErr(() => emailClient.getAvailabilityCalendars(signal)),
    enabled: identity() !== undefined,
    ...freshness,
  }));
}

/** Update one cached query now and restore it if the save fails; never blank it. */
interface CachedQuerySnapshot<T> {
  previous: T | undefined;
}

async function replaceCachedQuery<T>(
  queryKey: QueryKey,
  update: (current: T) => T
): Promise<CachedQuerySnapshot<T>> {
  await queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData<T>(queryKey);
  if (previous !== undefined)
    queryClient.setQueryData<T>(queryKey, update(previous));
  return { previous };
}

/**
 * Saves of one setting share a scope, so their requests reach the server in
 * order. Only the last pending save rolls back or refetches; an earlier one
 * would overwrite the newer optimistic choice.
 */
const isLastPendingSave = (mutationKey: QueryKey) =>
  queryClient.isMutating({ mutationKey }) === 1;

const teamSharingMutationKey = ['calendar-team', 'set-sharing'];

interface TeamSharingChange {
  identity: CalendarTeamIdentity;
  sharing: CalendarSharing;
}

const teamSharingMutationOptions = {
  mutationKey: teamSharingMutationKey,
  scope: { id: 'calendar-team-sharing' },
  mutationFn: ({ sharing }: TeamSharingChange) =>
    throwOnErr(() => emailClient.setTeamCalendarSharing({ sharing })),
  onMutate: ({ identity, sharing }: TeamSharingChange) =>
    replaceCachedQuery<TeamCalendarSharingBody>(
      calendarTeamKeys.sharing(identity).queryKey,
      () => ({ sharing })
    ),
  onError: (
    _error: unknown,
    { identity }: TeamSharingChange,
    snapshot: CachedQuerySnapshot<TeamCalendarSharingBody> | undefined
  ) => {
    if (snapshot?.previous && isLastPendingSave(teamSharingMutationKey))
      queryClient.setQueryData(
        calendarTeamKeys.sharing(identity).queryKey,
        snapshot.previous
      );
  },
  onSettled: (
    _data: unknown,
    _error: unknown,
    { identity }: TeamSharingChange
  ) =>
    isLastPendingSave(teamSharingMutationKey)
      ? queryClient.invalidateQueries({
          queryKey: calendarTeamKeys.sharing(identity).queryKey,
        })
      : undefined,
};

/** The viewer's own sharing never changes what they can read, so nothing else resets. */
export function useSetTeamCalendarSharingMutation() {
  return useMutation(() => teamSharingMutationOptions);
}

const availabilityCalendarMutationKey = [
  'calendar-team',
  'set-availability-calendar',
];

interface AvailabilityCalendarChange {
  identity: CalendarTeamIdentity;
  calendarIds: string[];
  contributesToAvailability: boolean;
}

/** Part of a group change saved; these calendars did not. */
class AvailabilityCalendarSaveError extends Error {
  constructor(readonly failedCalendarIds: string[]) {
    super('Could not update availability calendars');
  }
}

const availabilityCalendarMutationOptions = {
  mutationKey: availabilityCalendarMutationKey,
  scope: { id: 'calendar-team-availability-calendar' },
  mutationFn: async ({
    calendarIds,
    contributesToAvailability,
  }: AvailabilityCalendarChange) => {
    // Settle every request before reconciling, so no save can land after the
    // refetch that follows a failure.
    const results = await Promise.allSettled(
      calendarIds.map((calendarId) =>
        throwOnErr(() =>
          emailClient.setAvailabilityCalendar(calendarId, {
            contributesToAvailability,
          })
        )
      )
    );
    const failed = calendarIds.filter(
      (_, index) => results[index].status === 'rejected'
    );
    if (failed.length > 0) throw new AvailabilityCalendarSaveError(failed);
  },
  onMutate: ({
    identity,
    calendarIds,
    contributesToAvailability,
  }: AvailabilityCalendarChange) =>
    replaceCachedQuery<AvailabilityCalendarsResponse>(
      calendarTeamKeys.availabilityCalendars(identity).queryKey,
      (current) => ({
        calendars: current.calendars.map((calendar) =>
          calendarIds.includes(calendar.calendarId)
            ? { ...calendar, contributesToAvailability }
            : calendar
        ),
      })
    ),
  onError: (
    error: unknown,
    { identity, calendarIds }: AvailabilityCalendarChange,
    snapshot: CachedQuerySnapshot<AvailabilityCalendarsResponse> | undefined
  ) => {
    const previous = snapshot?.previous;
    if (!previous || !isLastPendingSave(availabilityCalendarMutationKey))
      return;
    const failed = new Set(
      error instanceof AvailabilityCalendarSaveError
        ? error.failedCalendarIds
        : calendarIds
    );
    const before = new Map(
      previous.calendars.map((calendar) => [calendar.calendarId, calendar])
    );
    queryClient.setQueryData<AvailabilityCalendarsResponse>(
      calendarTeamKeys.availabilityCalendars(identity).queryKey,
      (current) =>
        current && {
          calendars: current.calendars.map((calendar) =>
            failed.has(calendar.calendarId)
              ? (before.get(calendar.calendarId) ?? calendar)
              : calendar
          ),
        }
    );
  },
  onSettled: (
    _data: unknown,
    _error: unknown,
    { identity }: AvailabilityCalendarChange
  ) =>
    isLastPendingSave(availabilityCalendarMutationKey)
      ? queryClient.invalidateQueries({
          queryKey: calendarTeamKeys.availabilityCalendars(identity).queryKey,
        })
      : undefined,
};

/** Group changes save every calendar of an account in one optimistic step. */
export function useSetAvailabilityCalendarMutation() {
  return useMutation(() => availabilityCalendarMutationOptions);
}
