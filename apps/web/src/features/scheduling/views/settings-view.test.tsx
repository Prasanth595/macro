import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
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
  type EventType,
  newEventType,
  newSchedule,
  type SchedulingProfile,
  type SchedulingScope,
} from '../core/types';
import { BookingWorkspaceView } from './booking-workspace-view';
import { SchedulingSettingsView } from './settings-view';

vi.mock('./insights-view', () => ({ InsightsView: () => <div>Insights</div> }));

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
      Primary: Slot,
      Toolbar: Slot,
    },
    useViewShell: () => ({
      aside: { isCollapsed: () => false, isOverlay: () => false },
    }),
  };
});

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const getComputedStyle = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = getComputedStyle(element);
    // jsdom omits the browser's default animation-name: none.
    if (!style.animationName) style.animationName = 'none';
    return style;
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fixture(teamEditable = true) {
  const sources = new Map<string, SchedulingSource>();
  const saves = vi.fn();
  const loadsBookings = vi.fn();
  const openWorkspace = vi.fn();
  const createSource: SchedulingCapabilities['createSource'] = (
    scope,
    _range,
    loadBookings
  ) => {
    loadsBookings(scope().id, loadBookings?.());
    const [profile, setProfile] = createSignal<SchedulingProfile>({
      id: scope().id,
      name: scope().name,
      description: '',
      schedules: [newSchedule('UTC')],
      eventTypes: [],
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
        link: (profile, slug) => `/book/${profile.id}/${slug ?? ''}`,
        openTeamSettings: () => {},
        manageBooking: async () => {},
      }}
    >
      <SchedulingSettingsView onOpenWorkspace={openWorkspace} />
    </SchedulingProvider>
  ));
  return { sources, saves, loadsBookings, openWorkspace };
}

it('keeps settings focused on booking-page configuration and opens the workspace', () => {
  const { openWorkspace, loadsBookings } = fixture();
  expect(screen.getAllByRole('textbox', { name: 'Display name' })).toHaveLength(
    2
  );
  expect(screen.queryByRole('button', { name: 'New booking link' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Availability' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Bookings' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Insights' })).toBeNull();
  expect(loadsBookings.mock.calls).toEqual([
    ['personal', false],
    ['team', false],
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Open booking links' }));
  expect(openWorkspace).toHaveBeenCalledOnce();
});

it('saves page configuration for the selected owner without erasing another owner draft', async () => {
  const { sources, saves } = fixture();
  const personal = screen.getByRole('group', { name: 'Personal booking page' });
  const team = screen.getByRole('group', { name: 'Design booking page' });
  const personalName = within(personal).getByRole('textbox', {
    name: 'Display name',
  });
  fireEvent.input(personalName, { target: { value: 'Personal draft' } });
  fireEvent.input(within(team).getByRole('textbox', { name: 'Display name' }), {
    target: { value: 'Design meetings' },
  });
  fireEvent.click(
    within(team).getByRole('button', { name: 'Save booking page' })
  );
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(sources.get('team')?.profile()?.name).toBe('Design meetings');
  expect(sources.get('personal')?.profile()?.name).toBe('Personal');
  expect((personalName as HTMLInputElement).value).toBe('Personal draft');
});

it('keeps team page configuration read-only for members', () => {
  fixture(false);
  const team = screen.getByRole('group', { name: 'Design booking page' });
  expect(
    within(team)
      .getByRole('textbox', { name: 'Display name' })
      .hasAttribute('disabled')
  ).toBe(true);
  expect(
    within(team)
      .getByRole('button', { name: 'Save booking page' })
      .hasAttribute('disabled')
  ).toBe(true);
  expect(
    screen.getByText(
      'Only team owners and admins can edit Design booking settings.'
    )
  ).toBeTruthy();
});

function workspaceFixture(
  tab: BookingLinksState['tab'] = 'availability',
  initialEvent?: Partial<EventType>,
  scopes: SchedulingScope[] = [
    { id: 'personal', name: 'Personal', canEdit: true },
    { id: 'team', name: 'Design', teamId: 'team', canEdit: true },
  ]
) {
  const [search, setSearch] = createStore<BookingLinksState>({
    owner: 'personal',
    tab,
  });
  const [saving, setSaving] = createSignal(false);
  const saves = vi.fn();
  const copies = vi
    .fn<SchedulingCapabilities['copyLink']>()
    .mockResolvedValue(undefined);
  const createSource: SchedulingCapabilities['createSource'] = (scope) => {
    const schedule = newSchedule('UTC');
    const event = initialEvent
      ? {
          ...newEventType(schedule.id, ['user'], Boolean(scope().teamId)),
          title: 'Existing link',
          slug: 'existing-link',
          enabled: true,
          ...initialEvent,
        }
      : undefined;
    const [profile, setProfile] = createSignal<SchedulingProfile>({
      id: scope().id,
      name: scope().name,
      description: '',
      schedules: [schedule],
      eventTypes: event ? [event] : [],
      revision: 1,
    });
    return {
      profile,
      bookings: () => [],
      loading: () => false,
      error: () => undefined,
      saving,
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
  };
  render(() => (
    <SchedulingProvider
      value={{
        scopes: () => scopes,
        members: () => [],
        userId: () => 'user',
        createSource,
        copyLink: copies,
        link: (profile, slug) => `/book/${profile.id}/${slug ?? ''}`,
        openTeamSettings: () => {},
        manageBooking: async () => {},
      }}
    >
      <BookingWorkspaceView
        search={search}
        onSearchChange={setSearch}
        onSettings={() => {}}
      />
    </SchedulingProvider>
  ));
  return { search, setSearch, setSaving, saves, copies };
}

it('clears an availability editor when switching sections instead of reopening a lost draft', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture();
  await user.click(screen.getByRole('button', { name: 'New schedule' }));
  fireEvent.input(screen.getByRole('textbox', { name: 'Schedule name' }), {
    target: { value: 'Unsaved hours' },
  });
  const navigation = within(
    screen.getByRole('navigation', { name: 'Booking tabs' })
  );
  await user.click(navigation.getByRole('button', { name: 'Booking links' }));
  await user.click(navigation.getByRole('button', { name: 'Availability' }));
  expect(screen.queryByRole('textbox', { name: 'Schedule name' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Save schedule' })).toBeNull();
  expect(saves).not.toHaveBeenCalled();
});

it('clears availability editors on history tab changes and blocks UI navigation while saving', async () => {
  const user = userEvent.setup();
  const { search, setSearch, setSaving, saves } = workspaceFixture();
  await user.click(screen.getByRole('button', { name: 'New schedule' }));
  setSaving(true);
  await user.click(
    within(screen.getByRole('navigation', { name: 'Booking tabs' })).getByRole(
      'button',
      { name: 'Booking links' }
    )
  );
  expect(search.tab).toBe('availability');
  setSaving(false);
  setSearch('tab', 'links');
  setSearch('tab', 'availability');
  expect(screen.queryByRole('textbox', { name: 'Schedule name' })).toBeNull();
  expect(saves).not.toHaveBeenCalled();
});

it('keeps Personal first and switches each team independently without carrying drafts across owners', async () => {
  const user = userEvent.setup();
  const { search, setSaving, saves } = workspaceFixture(
    'availability',
    undefined,
    [
      { id: 'design', name: 'Design', teamId: 'design', canEdit: true },
      { id: 'personal', name: 'Personal', canEdit: true },
      {
        id: 'operations',
        name: 'Operations',
        teamId: 'operations',
        canEdit: false,
      },
    ]
  );
  const owners = within(
    screen.getByRole('navigation', { name: 'Booking calendar owner' })
  );
  expect(
    owners.getAllByRole('button').map((button) => button.textContent)
  ).toEqual(['Personal', 'Design', 'Operations']);
  await user.click(screen.getByRole('button', { name: 'New schedule' }));
  fireEvent.input(screen.getByRole('textbox', { name: 'Schedule name' }), {
    target: { value: 'Unsaved personal hours' },
  });
  setSaving(true);
  await user.click(owners.getByRole('button', { name: 'Design' }));
  expect(search.owner).toBe('personal');
  setSaving(false);
  await user.click(owners.getByRole('button', { name: 'Design' }));
  expect(search.owner).toBe('design');
  expect(search.tab).toBe('availability');
  expect(screen.queryByRole('textbox', { name: 'Schedule name' })).toBeNull();
  await user.click(owners.getByRole('button', { name: 'Operations' }));
  expect(search.owner).toBe('operations');
  expect(screen.queryByRole('button', { name: 'New schedule' })).toBeNull();
  await user.click(owners.getByRole('button', { name: 'Personal' }));
  expect(search.owner).toBe('personal');
  expect(screen.queryByRole('textbox', { name: 'Schedule name' })).toBeNull();
  expect(saves).not.toHaveBeenCalled();
});
