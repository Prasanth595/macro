import { createQueryKeys } from '@lukemorales/query-key-factory';

export interface CalendarTeamIdentity {
  userId: string;
  teamId: string;
}

/** Never normalized into the viewer's own-event GraphQL cache. */
export const calendarTeamKeys = createQueryKeys('calendar-team', {
  identity: (userId: string) => [userId],
  sharing: (identity: CalendarTeamIdentity | undefined) => [identity],
  availabilityCalendars: (identity: CalendarTeamIdentity | undefined) => [
    identity,
  ],
});
