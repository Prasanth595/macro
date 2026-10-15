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

function restoreCachedQuery<T>(
  queryKey: QueryKey,
  snapshot: CachedQuerySnapshot<T> | undefined
) {
  if (snapshot?.previous !== undefined)
    queryClient.setQueryData<T>(queryKey, snapshot.previous);
}

interface TeamSharingChange {
  identity: CalendarTeamIdentity;
  sharing: CalendarSharing;
}

const teamSharingMutationOptions = {
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
  ) =>
    restoreCachedQuery(calendarTeamKeys.sharing(identity).queryKey, snapshot),
  onSettled: (
    _data: unknown,
    _error: unknown,
    { identity }: TeamSharingChange
  ) =>
    queryClient.invalidateQueries({
      queryKey: calendarTeamKeys.sharing(identity).queryKey,
    }),
};

/** The viewer's own sharing never changes what they can read, so nothing else resets. */
export function useSetTeamCalendarSharingMutation() {
  return useMutation(() => teamSharingMutationOptions);
}

interface AvailabilityCalendarChange {
  identity: CalendarTeamIdentity;
  calendarIds: string[];
  contributesToAvailability: boolean;
}

const availabilityCalendarMutationOptions = {
  mutationFn: ({
    calendarIds,
    contributesToAvailability,
  }: AvailabilityCalendarChange) =>
    Promise.all(
      calendarIds.map((calendarId) =>
        throwOnErr(() =>
          emailClient.setAvailabilityCalendar(calendarId, {
            contributesToAvailability,
          })
        )
      )
    ),
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
    _error: unknown,
    { identity }: AvailabilityCalendarChange,
    snapshot: CachedQuerySnapshot<AvailabilityCalendarsResponse> | undefined
  ) =>
    restoreCachedQuery(
      calendarTeamKeys.availabilityCalendars(identity).queryKey,
      snapshot
    ),
  onSettled: (
    _data: unknown,
    _error: unknown,
    { identity }: AvailabilityCalendarChange
  ) =>
    queryClient.invalidateQueries({
      queryKey: calendarTeamKeys.availabilityCalendars(identity).queryKey,
    }),
};

/** Group changes save every calendar of an account in one optimistic step. */
export function useSetAvailabilityCalendarMutation() {
  return useMutation(() => availabilityCalendarMutationOptions);
}
