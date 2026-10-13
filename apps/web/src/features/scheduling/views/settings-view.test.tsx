import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@solidjs/testing-library';
import { createSignal, type JSX, type ParentProps } from 'solid-js';
import { createStore } from 'solid-js/store';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BookingLinksState } from '../booking-links-search';
import {
  type SchedulingCapabilities,
  SchedulingProvider,
  type SchedulingSource,
} from '../context/scheduling-context';
import {
  newEventType,
  newSchedule,
  type SchedulingProfile,
} from '../core/types';
import { BookingWorkspaceView } from './booking-workspace-view';

vi.mock('./insights-view', () => ({ InsightsView: () => <div>Insights</div> }));
vi.mock('./event-editor-view', () => ({
  EventEditor: (props: {
    event: SchedulingProfile['eventTypes'][number];
    onSave: (event: SchedulingProfile['eventTypes'][number]) => Promise<void>;
    onCancel: () => void;
  }) => (
    <div>
      <button
        onClick={() =>
          void props.onSave({
            ...props.event,
            title: `${props.event.title} edited`,
          })
        }
      >
        Save test event
      </button>
      <button onClick={props.onCancel}>Cancel test event</button>
    </div>
  ),
}));

vi.mock('@app/components/view-shell', () => {
  const Slot = (props: ParentProps) => <div>{props.children}</div>;
  const Item = (props: JSX.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </button>
  );
  const Nav = (props: ParentProps<{ 'aria-label'?: string }>) => (
    <nav aria-label={props['aria-label']}>{props.children}</nav>
  );
  return {
    ViewShell: {
      Root: Slot,
      Aside: Slot,
      Main: Slot,
      TopBar: Slot,
      Header: Slot,
      Content: Slot,
    },
    ViewSidebar: {
      Root: Slot,
      Header: Slot,
      CloseButton: () => null,
      Title: Slot,
      Content: Slot,
      Nav,
      Item,
      Icon: Slot,
      Footer: Slot,
    },
  };
});

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function fixture(teamEditable = true) {
  const sources = new Map<string, SchedulingSource>();
  const saves = vi.fn();
  const createSource: SchedulingCapabilities['createSource'] = (scope) => {
    const schedule = { ...newSchedule('UTC'), id: 'same-schedule-id' };
    // Identical IDs ensure actions are routed by owner, not accidental ID matching.
    const event = {
      ...newEventType(schedule.id, ['user'], !!scope().teamId),
      id: 'same-event-id',
      enabled: true,
      title: scope().teamId ? 'Team planning' : 'Personal catch-up',
      slug: 'meeting',
    };
    const [profile, setProfile] = createSignal<SchedulingProfile>({
      id: scope().id,
      name: scope().name,
      description: '',
      schedules: [schedule],
      defaultScheduleId: schedule.id,
      eventTypes: [event],
      revision: 1,
    });
    const source: SchedulingSource = {
      profile,
      bookings: () => [],
      loading: () => false,
      error: () => undefined,
      saving: () => false,
      save: async (next) => {
        saves(scope().id, next);
        setProfile(next);
      },
      approve: async () => {},
      cancel: async () => {},
      loadInsights: async () => [],
      setAttendance: async () => {},
      reload: () => {},
    };
    sources.set(scope().id, source);
    return source;
  };
  const [search, setSearch] = createStore<BookingLinksState>({
    tab: 'links',
    owner: '',
  });
  render(() => (
    <SchedulingProvider
      value={{
        scopes: () => [
          { id: 'personal', name: 'Personal', canEdit: true },
          { id: 'team', name: 'Design', teamId: 'team', canEdit: teamEditable },
        ],
        members: () => [],
        userId: () => 'user',
        createSource,
        copyLink: async () => {},
        link: (p, slug) => `/book/${p.id}/${slug ?? ''}`,
        openTeamSettings: () => {},
        manageBooking: async () => {},
      }}
    >
      <BookingWorkspaceView search={search} onSearchChange={setSearch} />
    </SchedulingProvider>
  ));
  return { sources, saves };
}

it('switches owners and keeps link actions and editing within their owner', async () => {
  const { sources, saves } = fixture();
  const owners = screen.getByRole('navigation', {
    name: 'Booking calendar owner',
  });
  const personal = screen
    .getByRole('button', { name: 'Personal catch-up' })
    .closest('article')!;
  expect(within(personal).getByRole('link').getAttribute('href')).toBe(
    '/book/personal/meeting'
  );

  fireEvent.click(within(owners).getByRole('button', { name: 'Design' }));
  const team = screen
    .getByRole('button', { name: 'Team planning' })
    .closest('article')!;
  expect(screen.getByText('Team · Design')).toBeTruthy();
  expect(within(team).getByRole('link').getAttribute('href')).toBe(
    '/book/team/meeting'
  );
  fireEvent.click(within(team).getByRole('switch'));
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(sources.get('team')!.profile()!.eventTypes[0].enabled).toBe(false);
  expect(sources.get('personal')!.profile()!.eventTypes[0].enabled).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: 'Team planning' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save test event' }));
  await screen.findByRole('button', { name: 'Team planning edited' });
  expect(sources.get('personal')!.profile()!.eventTypes[0].title).toBe(
    'Personal catch-up'
  );
  fireEvent.click(within(owners).getByRole('button', { name: 'Personal' }));
  expect(
    screen.getByRole('button', { name: 'Personal catch-up' })
  ).toBeTruthy();
});

it('searches the selected owner and preserves read-only team access', () => {
  fixture(false);
  const owners = screen.getByRole('navigation', {
    name: 'Booking calendar owner',
  });
  fireEvent.click(within(owners).getByRole('button', { name: 'Design' }));
  const team = screen
    .getByRole('button', { name: 'Team planning' })
    .closest('article')!;
  expect(within(team).getByRole('switch').hasAttribute('disabled')).toBe(true);
  expect(
    within(team).queryByRole('button', { name: 'Options for Team planning' })
  ).toBeNull();
  expect(screen.queryByRole('button', { name: 'New booking link' })).toBeNull();
  const search = screen.getByRole('searchbox', {
    name: 'Search booking links',
  });
  fireEvent.input(search, { target: { value: 'Design' } });
  expect(
    screen.queryByRole('button', { name: 'Personal catch-up' })
  ).toBeNull();
  expect(screen.getByRole('button', { name: 'Team planning' })).toBeTruthy();
  fireEvent.input(search, { target: { value: 'unmatched' } });
  expect(screen.queryByRole('button', { name: 'Team planning' })).toBeNull();
  fireEvent.input(search, { target: { value: '' } });
  fireEvent.click(within(owners).getByRole('button', { name: 'Personal' }));
  fireEvent.click(screen.getByRole('button', { name: 'New booking link' }));
  expect(screen.getByRole('button', { name: 'Save test event' })).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Personal catch-up' })
  ).toBeTruthy();
});

it('creates a link for the chosen owner without replacing other owners', async () => {
  const { sources } = fixture();
  const owners = screen.getByRole('navigation', {
    name: 'Booking calendar owner',
  });
  fireEvent.click(within(owners).getByRole('button', { name: 'Design' }));
  fireEvent.click(screen.getByRole('button', { name: 'New booking link' }));
  await screen.findByRole('button', { name: 'Save test event' });
  fireEvent.click(screen.getByRole('button', { name: 'Save test event' }));
  await waitFor(() =>
    expect(sources.get('team')!.profile()!.eventTypes).toHaveLength(2)
  );
  expect(sources.get('personal')!.profile()!.eventTypes).toHaveLength(1);
  expect(sources.get('personal')!.profile()!.name).toBe('Personal');
  fireEvent.click(within(owners).getByRole('button', { name: 'Personal' }));
  expect(
    screen.getByRole('button', { name: 'Personal catch-up' })
  ).toBeTruthy();
});
