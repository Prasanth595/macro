/**
 * @vitest-environment jsdom
 */

import type { CalendarEvent } from '@app/features/calendar/types';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectedEventDetails } from './SelectedEventDetails';

const mocks = vi.hoisted(() => ({
  mobile: false,
  openComposer: vi.fn(),
}));

vi.mock('@core/mobile/isMobile', () => ({ isMobile: () => mocks.mobile }));
vi.mock('@queries/calendar/calendars', () => ({
  useVisibleCalendarsQuery: () => ({ isSuccess: true, data: [] }),
}));
vi.mock('@queries/calendar/mutations', () => ({
  useDeleteCalendarEventMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));
vi.mock(
  '@app/features/calendar-view/components/use-open-event-composer',
  () => ({
    useOpenEventComposer: () => mocks.openComposer,
  })
);
vi.mock(
  '@app/features/calendar-view/components/use-forward-event-email',
  () => ({
    useForwardEventEmail: () => vi.fn(),
  })
);
vi.mock('@app/features/calendar/hooks/create-guest-invite-controller', () => ({
  createGuestInviteController: () => ({ editorOpen: () => false }),
}));
vi.mock('@app/features/calendar/hooks/use-calendar-ui-flag', () => ({
  useCalendarGuestInvitesFlag: () => () => false,
}));
// The sections below the header have their own tests; this one is about the
// header's actions.
vi.mock('@app/features/calendar/components/EventDetails', () => ({
  EventDetails: () => null,
}));
vi.mock('@app/features/calendar-view/components/EventGuests', () => ({
  EventGuests: () => null,
}));
vi.mock('@app/features/calendar-view/components/EventJoinRequests', () => ({
  EventJoinRequests: () => null,
}));
vi.mock('@app/features/calendar-view/components/EventRsvpSection', () => ({
  EventRsvpSection: () => null,
}));

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const NO_CAPABILITIES = {
  editDetails: false,
  inviteGuests: false,
  removeGuests: false,
  setGuestPolicy: false,
  rsvp: false,
  organize: false,
};

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: '["event-1","2026-10-23T19:00:00Z"]',
    eventId: 'event-1',
    occurrenceKey: '2026-10-23T19:00:00Z',
    isCancelled: false,
    isReadOnly: false,
    guestPolicy: {
      canModify: false,
      canInviteOthers: true,
      canSeeOtherGuests: true,
    },
    viewerCan: NO_CAPABILITIES,
    attendees: [
      {
        email: 'me@example.com',
        isOptional: false,
        isOrganizer: false,
        isSelf: true,
        responseStatus: 'accepted',
      },
    ],
    organizerEmail: 'host@example.com',
    recurrenceLines: [],
    title: 'Projects discussion',
    start: '2026-10-23T19:00:00Z',
    end: '2026-10-23T19:30:00Z',
    allDay: false,
    sourceCalendarIds: ['calendar-1'],
    calendarId: 'calendar-1',
    calendar: { id: 'calendar-1', name: 'Calendar', color: '#336699' },
    visibleCalendars: [],
    ...overrides,
  };
}

function showDetails(selected: CalendarEvent) {
  const boundary = document.createElement('div');
  const anchor = document.createElement('div');
  document.body.append(boundary, anchor);
  render(() => (
    <SelectedEventDetails
      boundary={boundary}
      anchor={() => anchor}
      event={() => selected}
      timeFormat={() => '12-hour'}
      onClose={vi.fn()}
    />
  ));
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ObserverStub);
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe.each([
  ['desktop popover', false],
  ['phone drawer', true],
])('in the %s', (_surface, mobile) => {
  beforeEach(() => {
    mocks.mobile = mobile;
  });

  it('offers no Edit on a snapshot, and deletes it as the viewer’s copy', async () => {
    showDetails(event({ isSnapshot: true }));

    expect(
      await screen.findByRole('button', { name: 'Delete your copy' })
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit event' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete event' })).toBeNull();
  });

  it('keeps Edit for a guest the organizer does not let modify', async () => {
    showDetails(event({ viewerCan: { ...NO_CAPABILITIES, rsvp: true } }));

    expect(
      await screen.findByRole('button', { name: 'Edit event' })
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete event' })).toBeTruthy();
  });
});
