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

vi.mock('@app/components/view-shell', async () => {
  const { SearchBar } = await import('@app/components/view-shell/SearchBar');
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
    SearchBar,
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fixture(teamEditable = true) {
  const sources = new Map<string, SchedulingSource>();
  const saves = vi.fn();
  let leave!: (signal: AbortSignal) => boolean | Promise<boolean>;
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
    const [saving, setSaving] = createSignal(false);
    const source: SchedulingSource = {
      profile,
      bookings: () => [],
      loading: () => false,
      error: () => undefined,
      saving,
      save: async (next) => {
        setSaving(true);
        try {
          await saves(scope().id, next);
          setProfile(next);
        } finally {
          setSaving(false);
        }
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
      <BookingWorkspaceView
        search={search}
        onSearchChange={setSearch}
        registerBeforeLeave={(guard) => {
          leave = guard;
        }}
      />
    </SchedulingProvider>
  ));
  return {
    sources,
    saves,
    search,
    setSearch,
    leave: (signal = new AbortController().signal) => leave(signal),
  };
}

it('switches owners and keeps link actions and editing within their owner', async () => {
  const { sources, saves } = fixture();
  const owners = screen.getByRole('navigation', {
    name: 'Booking calendar owner',
  });
  const personal = screen
    .getByRole('button', { name: 'Personal catch-up' })
    .closest('article')!;
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  fireEvent.keyDown(
    within(personal).getByRole('button', {
      name: 'Link actions for Personal catch-up',
    }),
    { key: 'ArrowDown' }
  );
  fireEvent.keyDown(
    await screen.findByRole('menuitem', { name: 'Open in new tab' }),
    { key: 'Enter' }
  );
  expect(open).toHaveBeenLastCalledWith(
    '/book/personal/meeting',
    '_blank',
    'noopener,noreferrer'
  );

  fireEvent.click(within(owners).getByRole('button', { name: 'Design' }));
  const team = screen
    .getByRole('button', { name: 'Team planning' })
    .closest('article')!;
  expect(screen.getByText('Team · Design')).toBeTruthy();
  fireEvent.keyDown(
    within(team).getByRole('button', {
      name: 'Link actions for Team planning',
    }),
    { key: 'ArrowDown' }
  );
  fireEvent.keyDown(
    await screen.findByRole('menuitem', { name: 'Open in new tab' }),
    { key: 'Enter' }
  );
  expect(open).toHaveBeenLastCalledWith(
    '/book/team/meeting',
    '_blank',
    'noopener,noreferrer'
  );
  fireEvent.click(within(team).getByRole('switch'));
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(sources.get('team')!.profile()!.eventTypes[0].enabled).toBe(false);
  expect(sources.get('personal')!.profile()!.eventTypes[0].enabled).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: 'Team planning' }));
  const details = await screen.findByRole('dialog', {
    name: 'Booking link details',
  });
  expect(within(details).getByText('Paused')).toBeTruthy();
  expect(within(details).queryByRole('button', { name: 'Next' })).toBeNull();
  expect(
    within(details).queryByRole('button', { name: 'Save test event' })
  ).toBeNull();
  expect(saves).toHaveBeenCalledOnce();
  fireEvent.click(
    within(details).getByRole('button', { name: 'Edit booking link' })
  );
  await screen.findByRole('button', { name: 'Save test event' });
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

it('searches the selected owner and preserves read-only team access', async () => {
  const { saves } = fixture(false);
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
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'New booking link' })).toBeNull();
  fireEvent.click(within(team).getByRole('button', { name: 'Team planning' }));
  const details = await screen.findByRole('dialog', {
    name: 'Booking link details',
  });
  expect(within(details).getByText('Team planning')).toBeTruthy();
  expect(within(details).getByText('Title', { exact: true }).tagName).toBe(
    'DT'
  );
  expect(
    within(details).getByText('Description', { exact: true }).tagName
  ).toBe('DT');
  const linkField = within(details).getByText('Link', { exact: true })
    .parentElement!;
  expect(within(linkField).getByText('/book/team/meeting')).toBeTruthy();
  expect(
    within(linkField).getByRole('button', { name: 'Copy booking link' })
  ).toBeTruthy();
  expect(
    within(details).queryByRole('button', { name: 'Edit booking link' })
  ).toBeNull();
  expect(within(details).queryByRole('switch')).toBeNull();
  expect(saves).not.toHaveBeenCalled();
  expect(within(details).queryByRole('button', { name: 'Close' })).toBeNull();
  fireEvent.click(
    within(details).getByRole('button', { name: 'Close booking link details' })
  );
  await waitFor(() => {
    expect(
      screen.queryByRole('dialog', { name: 'Booking link details' })
    ).toBeNull();
    expect(document.activeElement).toBe(
      within(team).getByRole('button', { name: 'Team planning' })
    );
  });
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

it('reverts booking page edits and guards tab and owner switching', async () => {
  const { sources } = fixture();
  const tabs = screen.getByRole('navigation', { name: 'Booking tabs' });
  fireEvent.click(within(tabs).getByRole('button', { name: 'Booking page' }));
  const name = screen.getByRole('textbox', { name: 'Display name' });
  const introduction = screen.getByRole('textbox', { name: 'Introduction' });
  expect(
    screen.queryByRole('button', { name: 'Revert booking page changes' })
  ).toBeNull();
  fireEvent.input(name, { target: { value: 'Draft' } });
  fireEvent.input(introduction, { target: { value: 'Draft introduction' } });
  fireEvent.click(
    screen.getByRole('button', { name: 'Revert booking page changes' })
  );
  expect(name).toHaveProperty('value', 'Personal');
  expect(introduction).toHaveProperty('value', '');
  fireEvent.input(name, { target: { value: 'Draft' } });
  fireEvent.input(name, { target: { value: 'Personal' } });
  expect(
    screen.queryByRole('button', { name: 'Revert booking page changes' })
  ).toBeNull();
  fireEvent.input(name, { target: { value: 'Draft' } });
  fireEvent.click(within(tabs).getByRole('button', { name: 'Insights' }));
  let dialog = await screen.findByRole('dialog', {
    name: 'Save booking page changes?',
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
  expect(name).toHaveProperty('value', 'Draft');
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Booking calendar owner' })
    ).getByRole('button', { name: 'Design' })
  );
  dialog = await screen.findByRole('dialog', {
    name: 'Save booking page changes?',
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' }));
  await waitFor(() =>
    expect(
      screen.getByRole('textbox', { name: 'Display name' })
    ).toHaveProperty('value', 'Design')
  );
  expect(sources.get('personal')!.profile()!.name).toBe('Personal');
});

it('retains failed leave saves and resumes navigation only after saving', async () => {
  const { sources, saves, leave } = fixture();
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Booking tabs' })).getByRole(
      'button',
      { name: 'Booking page' }
    )
  );
  fireEvent.input(screen.getByRole('textbox', { name: 'Display name' }), {
    target: { value: 'Saved after retry' },
  });
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  saves.mockRejectedValueOnce(new Error('Offline'));
  const result = leave();
  const dialog = await screen.findByRole('dialog', {
    name: 'Save booking page changes?',
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  expect((await within(dialog).findByRole('alert')).textContent).toBe(
    'Offline'
  );
  expect(
    screen.getByRole('textbox', { name: 'Display name', hidden: true })
  ).toHaveProperty('value', 'Saved after retry');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  expect(await result).toBe(true);
  expect(sources.get('personal')!.profile()!.name).toBe('Saved after retry');
  expect(leave()).toBe(true);
  const cleanUnload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(cleanUnload);
  expect(cleanUnload.defaultPrevented).toBe(false);
});
