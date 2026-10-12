import { I18nProvider } from '@kobalte/core/i18n';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createRoot, createSignal, type JSX, type ParentProps } from 'solid-js';
import { createStore } from 'solid-js/store';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BookingLinksState } from '../booking-links-search';
import { BookingFieldInfo } from '../components/booking-field-info';
import {
  BookingRuleSliders,
  BookingValueSlider,
} from '../components/booking-rule-sliders';
import { BookingRuleTimeline } from '../components/booking-rule-timeline';
import { BookingValueInput } from '../components/booking-value-input';
import { EventReview } from '../components/event-review';
import { EventTypesPanel } from '../components/event-types-panel';
import {
  type SchedulingCapabilities,
  SchedulingProvider,
  type SchedulingSource,
} from '../context/scheduling-context';
import { BUFFER_TIMELINE } from '../core/booking-rule-timeline';
import {
  automaticBookingUnit,
  convertBookingValue,
  DAY_UNITS,
  describeBookingValue,
  displayBookingValue,
  MINUTE_UNITS,
  NOTICE_UNITS,
  storedBookingValue,
} from '../core/booking-units';
import { bookingRulesSummary } from '../core/event-editor';
import {
  type EventType,
  newEventType,
  newSchedule,
  type SchedulingProfile,
  type SchedulingScope,
} from '../core/types';
import { createEventEditor } from '../primitives/create-event-editor';
import { BookingWorkspaceView } from './booking-workspace-view';
import { EventEditor } from './event-editor-view';
import { SchedulingSettingsView } from './settings-view';

const device = vi.hoisted(() => ({ mobile: false }));
vi.mock('@core/mobile/isMobile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@core/mobile/isMobile')>()),
  isMobile: () => device.mobile,
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
      Primary: Slot,
      Toolbar: Slot,
    },
    useViewShell: () => ({
      aside: { isCollapsed: () => false, isOverlay: () => false },
    }),
  };
});

beforeEach(() => {
  device.mobile = false;
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

function unitText(input: HTMLElement) {
  return input
    .closest('[data-number-unit-input]')
    ?.querySelector('[data-number-unit]')?.textContent;
}

function bookingRuleInput(label: string) {
  const inputLabel =
    label === 'Meeting buffers'
      ? 'Before each meeting'
      : label === 'Minimum notice' || label === 'From'
        ? "What's the earliest someone can book?"
        : label === 'Booking window' || label === 'To'
          ? "What's the latest someone can book?"
          : label;
  return screen.getByRole('spinbutton', { name: `${inputLabel} exact value` });
}

function bookingRuleSelect(label: string) {
  return screen.getByRole('combobox', {
    name: new RegExp(`^${label}(?: |$)`),
  });
}

function expectStepProgress(
  container: HTMLElement,
  step: number,
  heading: string
) {
  const progress = within(container).getByRole('progressbar', {
    name: 'Booking setup progress',
  });
  expect(progress.getAttribute('aria-valuemin')).toBe('1');
  expect(progress.getAttribute('aria-valuemax')).toBe('5');
  expect(progress.getAttribute('aria-valuenow')).toBe(String(step));
  expect(progress.getAttribute('aria-valuetext')).toBe(
    `Step ${step} of 5: ${heading}`
  );
  return progress;
}

async function selectBookingRule(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  value: string
) {
  await user.click(bookingRuleSelect(label));
  await user.click(screen.getByRole('option', { name: value }));
}
async function focusBookingRule(
  user: ReturnType<typeof userEvent.setup>,
  label: string
) {
  const input = bookingRuleInput(label);
  await user.click(input);
  if (label === 'Meeting buffers')
    return screen.getByRole('region', { name: 'Time between meetings' });
  if (['Minimum notice', 'Booking window', 'From', 'To'].includes(label))
    return screen.getByRole('group', { name: 'Booking range' });
  return screen
    .getAllByRole('group', { name: label })
    .find((group) => group.contains(input))!;
}

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

it('uses an automatic unique link when custom link text is cleared', async () => {
  const saved = vi.fn();
  const existing = {
    ...newEventType('hours', ['user'], false),
    id: 'existing',
    title: 'Intro call',
    slug: 'intro-call',
  };
  const [editor, dispose] = createRoot(
    (dispose) =>
      [
        createEventEditor({
          event: newEventType('hours', ['user'], false),
          events: () => [existing],
          hasSchedule: () => true,
          missingHosts: () => [],
          createActive: () => true,
          onSave: saved,
        }),
        dispose,
      ] as const
  );
  try {
    editor.setTitle('Intro call');
    editor.update('slug', '');
    editor.next();
    expect(editor.step()).toBe('location');
    expect(editor.issues()).toEqual([]);
    expect(editor.slug()).toBe('intro-call-2');
    await editor.save();
    expect(saved).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'intro-call-2', enabled: true })
    );
    editor.update('slug', 'bad link');
    await editor.save();
    expect(editor.issues()).toContainEqual(
      expect.objectContaining({ field: 'slug' })
    );
    expect(saved).toHaveBeenCalledTimes(1);
    editor.update('slug', '');
    editor.setTitle('Discovery call');
    expect(editor.slug()).toBe('discovery-call');
  } finally {
    dispose();
  }
});

it('preserves saved URLs when renaming and changes URLs only through explicit link edits', async () => {
  const saved = vi.fn();
  const event = {
    ...newEventType('hours', ['user'], false),
    title: 'Meeting',
    slug: 'meeting',
  };
  const [editor, dispose] = createRoot(
    (dispose) =>
      [
        createEventEditor({
          event,
          events: () => [event],
          hasSchedule: () => true,
          missingHosts: () => [],
          createActive: () => true,
          onSave: saved,
        }),
        dispose,
      ] as const
  );
  try {
    editor.setTitle('Renamed meeting');
    expect(editor.draft().slug).toBe('meeting');
    expect(editor.slug()).toBe('meeting');
    await editor.save();
    expect(saved).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Renamed meeting', slug: 'meeting' })
    );
    editor.removeDetail('link');
    expect(editor.slug()).toBe('renamed-meeting');
    editor.setTitle('Another meeting title');
    expect(editor.slug()).toBe('renamed-meeting');
    editor.update('slug', 'custom-meeting');
    editor.setTitle('One more title');
    await editor.save();
    expect(saved).toHaveBeenLastCalledWith(
      expect.objectContaining({ slug: 'custom-meeting' })
    );
  } finally {
    dispose();
  }
});

it('generates unique URLs for new matching titles and still rejects explicit duplicate custom links', async () => {
  const saved = vi.fn();
  const existing = {
    ...newEventType('hours', ['user'], false),
    title: 'Intro call',
    slug: 'intro-call',
  };
  const event = {
    ...newEventType('hours', ['user'], false),
    title: 'Intro call',
    slug: 'intro-call',
  };
  const [editor, dispose] = createRoot(
    (dispose) =>
      [
        createEventEditor({
          event,
          events: () => [
            existing,
            { ...existing, id: 'second', slug: 'intro-call-2' },
          ],
          hasSchedule: () => true,
          missingHosts: () => [],
          createActive: () => true,
          onSave: saved,
        }),
        dispose,
      ] as const
  );
  try {
    expect(editor.slug()).toBe('intro-call-3');
    expect(editor.canGoToStep('review')).toBe(true);
    editor.setTitle('Intro call');
    expect(editor.draft().slug).toBe('intro-call-3');
    editor.next();
    expect(editor.step()).toBe('location');
    await editor.save();
    expect(saved).toHaveBeenLastCalledWith(
      expect.objectContaining({ slug: 'intro-call-3' })
    );
    editor.update('slug', 'intro-call');
    await editor.save();
    expect(editor.issues()).toContainEqual(
      expect.objectContaining({
        field: 'slug',
        message: 'Another event uses this link.',
      })
    );
    expect(saved).toHaveBeenCalledTimes(1);
    editor.removeDetail('link');
    expect(editor.slug()).toBe('intro-call-3');
  } finally {
    dispose();
  }
});
it('shows step progress in the header and validates sequential navigation', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  const dialog = screen.getByRole('dialog', {
    name: 'New personal booking link',
  });
  const header = dialog.querySelector<HTMLElement>('header')!;
  const form = within(dialog);
  expect(
    form.queryByRole('navigation', { name: 'Booking link steps' })
  ).toBeNull();
  expect(form.queryByRole('tablist')).toBeNull();
  expect(within(header).queryByRole('button')).toBeNull();
  expect(within(header).queryByRole('heading')).toBeNull();
  const currentHeading = form.getByRole('heading', {
    name: 'Meeting details',
  });
  expect(
    currentHeading.parentElement?.hasAttribute('data-booking-scroll-area')
  ).toBe(true);
  expectStepProgress(header, 1, 'Meeting details');
  await user.click(form.getByRole('button', { name: 'Next' }));
  const title = form.getByRole('textbox', { name: 'Title' });
  expect(title.getAttribute('aria-invalid')).toBe('true');
  expectStepProgress(header, 1, 'Meeting details');
  fireEvent.input(title, { target: { value: 'Intro call' } });
  for (const [index, [step, heading]] of [
    ['location', 'Location & availability'],
    ['questions', 'Questions'],
    ['rules', 'Booking rules'],
    ['review', 'Review'],
  ].entries()) {
    await user.click(form.getByRole('button', { name: 'Next' }));
    const currentHeading = form.getByRole('heading', { name: heading });
    expect(
      currentHeading.parentElement?.hasAttribute('data-booking-scroll-area')
    ).toBe(true);
    expectStepProgress(header, index + 2, heading);
    expect(form.getAllByRole('heading', { name: heading })).toHaveLength(1);
    const panel = dialog.querySelector<HTMLElement>(
      `[data-booking-step="${step}"]`
    )!;
    expect(panel.getAttribute('aria-labelledby')).toBe(currentHeading.id);
    await waitFor(() => expect(document.activeElement).toBe(panel));
    expect(saves).not.toHaveBeenCalled();
  }
  for (let index = 0; index < 4; index++) {
    await user.click(form.getByRole('button', { name: 'Back' }));
  }
  expect(form.getByRole('textbox', { name: 'Title' })).toBe(title);
  fireEvent.input(title, { target: { value: '' } });
  await user.click(form.getByRole('button', { name: 'Next' }));
  expectStepProgress(header, 1, 'Meeting details');
  expect(saves).not.toHaveBeenCalled();
});

it('enforces timeline guards and revalidates earlier steps on Next', () => {
  const [editor, dispose] = createRoot(
    (dispose) =>
      [
        createEventEditor({
          event: newEventType('hours', ['user'], false),
          events: () => [],
          hasSchedule: (id) => id === 'hours',
          missingHosts: () => [],
          createActive: () => true,
          onSave: async () => {},
        }),
        dispose,
      ] as const
  );
  try {
    editor.goToStep('review');
    expect(editor.step()).toBe('details');
    editor.setTitle('Meeting');
    editor.goToStep('questions');
    expect(editor.step()).toBe('questions');
    expect(editor.canGoToStep('review')).toBe(true);
    editor.update('scheduleId', 'missing');
    expect(editor.canGoToStep('review')).toBe(false);
    editor.goToStep('review');
    expect(editor.step()).toBe('questions');
    editor.next();
    expect(editor.step()).toBe('location');
    expect(editor.issues()).toContainEqual(
      expect.objectContaining({ field: 'scheduleId' })
    );
    editor.goToStep('details');
    expect(editor.canGoToStep('location')).toBe(true);
    editor.setTitle('');
    expect(editor.canGoToStep('location')).toBe(false);
    editor.setTitle('Meeting');
    editor.update('scheduleId', 'hours');
    expect(editor.canGoToStep('review')).toBe(true);
  } finally {
    dispose();
  }
});
it('advances without saving and routes invalid saves to the relevant step', async () => {
  const saved = vi.fn();
  const [editor, dispose] = createRoot(
    (dispose) =>
      [
        createEventEditor({
          event: newEventType('hours', ['user'], false),
          events: () => [],
          missingHosts: () => [],
          hasSchedule: (id) => id === 'hours',
          createActive: () => true,
          onSave: saved,
        }),
        dispose,
      ] as const
  );
  try {
    editor.next();
    expect(editor.step()).toBe('details');
    expect(editor.issues()).toContainEqual(
      expect.objectContaining({
        field: 'title',
        message: expect.stringContaining('title'),
      })
    );
    editor.setTitle('Intro call');
    editor.next();
    expect(editor.step()).toBe('location');
    editor.next();
    editor.update('questions', [{ id: 'question', label: '', required: true }]);
    editor.next();
    expect(editor.step()).toBe('rules');
    expect(editor.issues()).toEqual([]);
    editor.update('questions', [
      { id: 'question', label: 'Topic?', required: true },
    ]);
    editor.next();
    expect(editor.step()).toBe('review');
    expect(saved).not.toHaveBeenCalled();
    editor.update('intervalMinutes', 0);
    await editor.save();
    expect(editor.step()).toBe('rules');
    expect(editor.issues()).toContainEqual(
      expect.objectContaining({
        field: 'intervalMinutes',
        message: expect.stringContaining('interval'),
      })
    );
    expect(saved).not.toHaveBeenCalled();
    editor.update('intervalMinutes', 15);
    editor.next();
    await editor.save();
    expect(saved).toHaveBeenCalledOnce();
    expect(saved.mock.calls[0][0]).toMatchObject({
      title: 'Intro call',
      enabled: true,
      questions: [{ id: 'question', label: 'Topic?', required: true }],
    });
  } finally {
    dispose();
  }
});
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

async function advanceEditor(
  user: ReturnType<typeof userEvent.setup>,
  count: number
) {
  const title = screen.queryByRole('textbox', {
    name: 'Title',
  }) as HTMLInputElement | null;
  if (title && !title.value.trim())
    fireEvent.input(title, { target: { value: 'Example booking link' } });
  for (let step = 0; step < count; step++)
    await user.click(screen.getByRole('button', { name: 'Next' }));
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

it('dismisses link dialogs on history owner changes and does not reopen the stale draft', async () => {
  const user = userEvent.setup();
  const { setSearch, saves } = workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  fireEvent.input(screen.getByRole('textbox', { name: 'Title' }), {
    target: { value: 'Unsaved personal link' },
  });
  setSearch('owner', 'team');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  setSearch('owner', 'personal');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('textbox', { name: 'Title' })).toBeNull();
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

it('composes booking-card options with padded dropdown groups and standard item spacing', async () => {
  const user = userEvent.setup();
  const event = {
    ...newEventType('hours', ['user'], false),
    title: 'Example',
    enabled: true,
  };
  render(() => (
    <EventTypesPanel
      events={[event]}
      canEdit
      saving={false}
      onEdit={() => {}}
      onToggle={() => {}}
      onDuplicate={() => {}}
      onDelete={() => {}}
      onCopy={() => {}}
      link={() => '/book/example'}
    />
  ));
  await user.click(screen.getByRole('button', { name: 'Options for Example' }));
  const edit = screen.getByRole('menuitem', { name: 'Edit' });
  const remove = screen.getByRole('menuitem', { name: 'Delete' });
  expect(edit.className).toContain('p-1.5');
  expect(edit.className).toContain('px-2');
  expect(edit.closest('[role="group"]')?.className).toContain('p-1.5');
  expect(edit.closest('[role="group"]')).not.toBe(
    remove.closest('[role="group"]')
  );
});

it('keeps duplicated links paused and creates new links as active without Save draft', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links', { enabled: true });
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  fireEvent.input(screen.getByRole('textbox', { name: 'Title' }), {
    target: { value: 'First link' },
  });
  expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
  await advanceEditor(user, 4);
  await user.click(screen.getByRole('button', { name: 'Create link' }));
  await waitFor(() => expect(saves).toHaveBeenCalledTimes(1));
  expect(saves.mock.calls[0][1].eventTypes[1]).toMatchObject({
    title: 'First link',
    enabled: true,
  });
  await user.click(
    screen.getByRole('button', { name: 'Options for Existing link' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
  expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
  await advanceEditor(user, 4);
  await user.click(screen.getByRole('button', { name: 'Create link' }));
  await waitFor(() => expect(saves).toHaveBeenCalledTimes(2));
  expect(saves.mock.calls[1][1].eventTypes).toMatchObject([
    { title: 'Existing link', enabled: true },
    { title: 'First link', enabled: true },
    {
      title: 'Existing link (copy)',
      slug: 'existing-link-copy',
      enabled: false,
    },
  ]);
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  fireEvent.input(screen.getByRole('textbox', { name: 'Title' }), {
    target: { value: 'Active link' },
  });
  expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
  await advanceEditor(user, 4);
  await user.click(screen.getByRole('button', { name: 'Create link' }));
  await waitFor(() => expect(saves).toHaveBeenCalledTimes(3));
  expect(saves.mock.calls[2][1].eventTypes[3]).toMatchObject({
    title: 'Active link',
    enabled: true,
  });
});

it.each([true, false])(
  'changes an existing link activation only when saved (enabled=%s)',
  async (enabled) => {
    const user = userEvent.setup();
    const { saves, setSaving } = workspaceFixture('links', { enabled });
    await user.click(
      screen.getByRole('button', { name: 'Options for Existing link' })
    );
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const editor = within(
      screen.getByRole('dialog', { name: 'Edit booking link' })
    );
    await advanceEditor(user, 4);
    const activation = editor.getByRole('switch', {
      name: 'Accept bookings',
    }) as HTMLInputElement;
    expect(activation.checked).toBe(enabled);
    await user.click(activation);
    expect(activation.checked).toBe(!enabled);
    expect(editor.getByRole('switch', { name: 'Accept bookings' })).toBe(
      activation
    );
    expect(document.activeElement).toBe(activation);
    const status = editor
      .getByText('Status')
      .parentElement!.querySelector('dd')!;
    expect(status.textContent).toContain(enabled ? 'Paused' : 'Active');
    const statusValue = status.firstElementChild as HTMLElement;
    expect(statusValue.classList.contains('flex')).toBe(true);
    expect(statusValue.classList.contains('items-center')).toBe(true);
    expect(statusValue.contains(activation)).toBe(true);
    expect(saves).not.toHaveBeenCalled();
    setSaving(true);
    expect(activation.hasAttribute('disabled')).toBe(true);
    setSaving(false);
    await user.click(editor.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(saves).toHaveBeenCalledOnce());
    expect(saves.mock.calls[0][1].eventTypes[0].enabled).toBe(!enabled);
  }
);

it('updates automatic confirmation on Review without submitting or saving', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links', { requiresConfirmation: true });
  await user.click(
    screen.getByRole('button', { name: 'Options for Existing link' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
  const editor = within(
    screen.getByRole('dialog', { name: 'Edit booking link' })
  );
  await advanceEditor(user, 4);
  const action = editor.getByRole('button', {
    name: 'Use automatic confirmation',
  });
  expect(action.getAttribute('type')).toBe('button');
  await user.click(action);
  expect(
    editor.queryByRole('button', { name: 'Use automatic confirmation' })
  ).toBeNull();
  expect(editor.getByRole('heading', { name: 'Review' })).toBeTruthy();
  expect(saves).not.toHaveBeenCalled();
  await user.click(editor.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(saves.mock.calls[0][1].eventTypes[0]).toMatchObject({
    requiresConfirmation: false,
    enabled: true,
  });
});

it('resets team hosts on Location without advancing or saving', async () => {
  const user = userEvent.setup();
  const schedule = newSchedule('UTC');
  const event = {
    ...newEventType(schedule.id, ['alice', 'bob'], true),
    title: 'Team call',
    slug: 'team-call',
    mode: 'roundRobin' as const,
  };
  const save = vi.fn().mockResolvedValue(undefined);
  const change = vi.fn();
  render(() => (
    <EventEditor
      event={event}
      events={[event]}
      schedules={[schedule]}
      members={[
        { id: 'alice', name: 'Alice', email: 'alice@example.com' },
        { id: 'bob', name: 'Bob', email: 'bob@example.com' },
      ]}
      team
      defaultHosts={['alice']}
      saving={false}
      dialogTitle="Edit booking link"
      onChange={change}
      onSave={save}
      onCancel={() => {}}
    />
  ));
  await advanceEditor(user, 1);
  const editor = within(
    screen.getByRole('dialog', { name: 'Edit booking link' })
  );
  await user.click(editor.getByRole('button', { name: 'Edit team hosts' }));
  const reset = editor.getByRole('button', { name: 'Reset team hosts' });
  expect(reset.getAttribute('type')).toBe('button');
  await user.click(reset);
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({
      hosts: ['alice'],
      mode: 'collective',
    })
  );
  expect(
    editor.getByRole('heading', { name: 'Location & availability' })
  ).toBeTruthy();
  expect(editor.queryByRole('heading', { name: 'Questions' })).toBeNull();
  expect(save).not.toHaveBeenCalled();
});

it('focuses a surviving question or Add a question after individual removal', async () => {
  const user = userEvent.setup();
  workspaceFixture('links', {
    questions: [
      { id: 'first', label: 'First question', required: false },
      { id: 'middle', label: 'Middle question', required: true },
      { id: 'last', label: 'Last question', required: false },
    ],
  });
  await user.click(
    screen.getByRole('button', { name: 'Options for Existing link' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
  await advanceEditor(user, 2);
  await user.click(screen.getByRole('button', { name: 'Remove question 1' }));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Question 1' })
    )
  );
  expect((document.activeElement as HTMLInputElement).value).toBe(
    'Middle question'
  );
  await user.click(screen.getByRole('button', { name: 'Remove question 2' }));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Question 1' })
    )
  );
  expect((document.activeElement as HTMLInputElement).value).toBe(
    'Middle question'
  );
  await user.click(screen.getByRole('button', { name: 'Remove question 1' }));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Add a question' })
    )
  );
  expect(screen.queryByRole('textbox', { name: 'Question 1' })).toBeNull();
});

it('opens field help as a wrapped, bounded, click-only popover within the editor', async () => {
  const user = userEvent.setup();
  const submit = vi.fn();
  const { container } = render(() => (
    <div class="portal-scope">
      <form onSubmit={submit}>
        <BookingFieldInfo
          label="Booking window"
          description="How far into the future guests can book a meeting."
        />
      </form>
    </div>
  ));
  const trigger = screen.getByRole('button', { name: 'About booking window' });
  await user.hover(trigger);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('tooltip')).toBeNull();
  await user.click(trigger);
  const help = await screen.findByRole('dialog', {
    name: 'About booking window',
  });
  expect(help.className).toContain('max-w-');
  expect(help.className).toContain('whitespace-normal');
  expect(help.className).toContain('break-words');
  expect(container.querySelector('.portal-scope')?.contains(help)).toBe(true);
  expect(submit).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

it('dismisses field help without closing its parent booking-link dialog', async () => {
  const user = userEvent.setup();
  workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  const editor = screen.getByRole('dialog', {
    name: 'New personal booking link',
  });
  await advanceEditor(user, 3);
  const trigger = within(editor).getByRole('button', {
    name: 'About time between meetings',
  });
  await user.click(trigger);
  const help = await screen.findByRole('dialog', {
    name: 'About time between meetings',
  });
  expect(editor.contains(help)).toBe(true);
  expect(help.textContent).toContain(
    'Add time before a meeting to prepare or after one to take a break.'
  );
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'About time between meetings' })
    ).toBeNull()
  );
  expect(
    screen.getByRole('dialog', { name: 'New personal booking link' })
  ).toBe(editor);
  expect(document.activeElement).toBe(trigger);
});

it('keeps description visible and edits the link through an icon-triggered popover', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  const editor = screen.getByRole('dialog', {
    name: 'New personal booking link',
  });
  expect(
    within(editor).getByRole('textbox', { name: 'Description' })
  ).toBeTruthy();
  expect(
    within(editor).queryByRole('button', {
      name: /(?:Add|Remove) [Dd]escription/,
    })
  ).toBeNull();
  expect(
    within(editor).queryByRole('button', { name: 'About description' })
  ).toBeNull();
  expect(
    within(editor).queryByRole('button', { name: 'About duration' })
  ).toBeNull();
  expect(
    within(editor).queryByRole('button', { name: 'Use automatic link' })
  ).toBeNull();
  expect(screen.queryByRole('textbox', { name: 'Custom link' })).toBeNull();
  const title = within(editor).getByRole('textbox', { name: 'Title' });
  fireEvent.input(title, { target: { value: 'Intro call' } });
  const trigger = within(editor).getByRole('button', { name: 'Edit link' });
  expect(trigger.textContent).toBe('');
  expect(trigger.querySelector('svg')).toBeTruthy();
  await user.click(trigger);
  const linkEditor = await screen.findByRole('dialog', {
    name: 'Edit booking link',
  });
  expect(editor.contains(linkEditor)).toBe(true);
  expect(document.activeElement).toBe(
    within(linkEditor).getByRole('textbox', { name: 'Custom link' })
  );
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Edit booking link' })
    ).toBeNull()
  );
  expect(document.activeElement).toBe(trigger);
  expect(
    screen.getByRole('dialog', { name: 'New personal booking link' })
  ).toBe(editor);
  fireEvent.input(title, { target: { value: 'Discovery call' } });
  expect(
    within(editor).getByText('/book/personal/discovery-call')
  ).toBeTruthy();
  await user.click(trigger);
  fireEvent.input(await screen.findByRole('textbox', { name: 'Custom link' }), {
    target: { value: 'meet-with-me' },
  });
  await user.keyboard('{Escape}');
  fireEvent.input(title, { target: { value: 'A new title' } });
  expect(within(editor).getByText('/book/personal/meet-with-me')).toBeTruthy();
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Reset to title' }));
  expect(
    (screen.getByRole('textbox', { name: 'Custom link' }) as HTMLInputElement)
      .value
  ).toBe('a-new-title');
  await user.keyboard('{Escape}');
  fireEvent.input(title, { target: { value: 'Final title' } });
  expect(within(editor).getByText('/book/personal/final-title')).toBeTruthy();
  expect(saves).not.toHaveBeenCalled();
});

it('combines booking range inputs and edits interval values through a shared select', async () => {
  const user = userEvent.setup();
  const [draft, setDraft] = createSignal({
    ...newEventType('hours', ['user'], false),
    intervalMinutes: 17,
  });
  render(() => (
    <BookingRuleSliders
      onDailyLimitEnabled={() => {}}
      draft={draft()}
      disabled={false}
      onUpdate={(key, value) =>
        setDraft((current) => ({ ...current, [key]: value }))
      }
      onBuffers={(beforeMinutes, afterMinutes) =>
        setDraft((current) => ({ ...current, beforeMinutes, afterMinutes }))
      }
    />
  ));
  const range = screen.getByRole('group', { name: 'Booking range' });
  expect(range.getAttribute('aria-describedby')).toBeTruthy();
  expect(
    screen.getByText(
      'Guests can choose any available time between these limits, measured from now.'
    )
  ).toBeTruthy();
  for (const label of [
    "What's the earliest someone can book?",
    "What's the latest someone can book?",
  ]) {
    const input = bookingRuleInput(label);
    const units = within(range).getByRole('combobox', {
      name: `${label} units`,
    });
    expect(range.contains(input)).toBe(true);
    expect(screen.getByLabelText(label)).toBe(input);
    const frame = input.closest('[data-number-unit-input]');
    expect(frame?.getAttribute('data-variant')).not.toBe('bare');
    expect(frame?.contains(units)).toBe(true);
    expect(screen.queryByRole('slider', { name: label })).toBeNull();
  }
  for (const label of ['Minimum notice', 'Booking window']) {
    expect(screen.queryByRole('slider', { name: label })).toBeNull();
    expect(
      screen.queryByRole('group', { name: `${label} presets` })
    ).toBeNull();
  }
  expect(
    screen.queryByRole('slider', { name: 'Time-slot interval' })
  ).toBeNull();
  expect((bookingRuleInput('From') as HTMLInputElement).value).toBe('2');
  expect((bookingRuleInput('To') as HTMLInputElement).value).toBe('60');
  await focusBookingRule(user, 'Time-slot interval');
  expect(
    screen.getByRole('spinbutton', { name: 'Time-slot interval exact value' })
  ).toBeTruthy();
  expect(
    screen.queryByRole('combobox', { name: /^Time-slot interval units/ })
  ).toBeNull();
  const intervalSelect = bookingRuleSelect('Time-slot interval');
  expect(intervalSelect.textContent).toContain('Custom');
  expect(draft().intervalMinutes).toBe(17);
  expect(
    screen.queryByRole('group', { name: 'Time-slot interval presets' })
  ).toBeNull();
  await selectBookingRule(user, 'Time-slot interval', '15 min');
  expect(draft().intervalMinutes).toBe(15);
  expect(intervalSelect.textContent).toContain('15 min');
  await waitFor(() => expect(document.activeElement).toBe(intervalSelect));
  expect(
    screen.queryByRole('spinbutton', { name: 'Time-slot interval exact value' })
  ).toBeNull();
  await selectBookingRule(user, 'Time-slot interval', 'Custom');
  const exactInterval = bookingRuleInput('Time-slot interval');
  await waitFor(() => expect(document.activeElement).toBe(exactInterval));
  fireEvent.input(exactInterval, { target: { value: '15' } });
  fireEvent.blur(exactInterval);
  expect(intervalSelect.textContent).toContain('Custom');
  expect(draft().intervalMinutes).toBe(15);
  await selectBookingRule(user, 'Time-slot interval', '20 min');
  expect(draft().intervalMinutes).toBe(20);
  expect(intervalSelect.textContent).toContain('20 min');
  expect(
    screen.queryByRole('spinbutton', { name: 'Time-slot interval exact value' })
  ).toBeNull();
  const earliest = bookingRuleInput('From');
  await user.click(earliest);
  fireEvent.input(earliest, { target: { value: '0' } });
  fireEvent.blur(earliest);
  expect(draft().noticeMinutes).toBe(0);
  expect(draft().horizonDays).toBe(60);
  const latest = bookingRuleInput('To');
  await user.click(latest);
  fireEvent.input(latest, { target: { value: '365' } });
  fireEvent.blur(latest);
  expect(draft().horizonDays).toBe(365);
  expect(draft().noticeMinutes).toBe(0);
});

it('uses labeled minute inputs for meeting spacing without sliders', async () => {
  const user = userEvent.setup();
  const [draft, setDraft] = createSignal({
    ...newEventType('hours', ['user'], false),
    beforeMinutes: 120,
    afterMinutes: 1440,
  });
  render(() => (
    <BookingRuleSliders
      onDailyLimitEnabled={() => {}}
      draft={draft()}
      disabled={false}
      onUpdate={() => {}}
      onBuffers={(beforeMinutes, afterMinutes) =>
        setDraft((current) => ({ ...current, beforeMinutes, afterMinutes }))
      }
    />
  ));
  await user.click(
    screen.getByRole('button', { name: 'About time between meetings' })
  );
  expect(
    screen.getByText(
      'Add time before a meeting to prepare or after one to take a break.'
    )
  ).toBeTruthy();
  const before = screen.getByRole('spinbutton', {
    name: 'Before each meeting exact value',
  }) as HTMLInputElement;
  const after = screen.getByRole('spinbutton', {
    name: 'After each meeting exact value',
  }) as HTMLInputElement;
  expect(before.value).toBe('120');
  expect(after.value).toBe('1440');
  expect(before.type).toBe('text');
  expect(after.type).toBe('text');
  expect(before.closest('[data-number-unit-input]')?.textContent).toBe('min');
  expect(after.closest('[data-number-unit-input]')?.textContent).toBe('min');
  expect(screen.queryByRole('slider')).toBeNull();
  fireEvent.input(before, { target: { value: '90' } });
  fireEvent.blur(before);
  expect(draft().beforeMinutes).toBe(90);
  expect(draft().afterMinutes).toBe(1440);
});

it('rounds whole-unit conversions inside field bounds and keeps automatic units exact', () => {
  expect(convertBookingValue(90, MINUTE_UNITS[1], 5, 480)).toBe(90);
  expect(convertBookingValue(15, MINUTE_UNITS[1], 5, 480)).toBe(15);
  expect(convertBookingValue(30, DAY_UNITS[1], 1, 365)).toBe(28);
  expect(convertBookingValue(365, DAY_UNITS[1], 1, 365)).toBe(364);
  expect(convertBookingValue(1, DAY_UNITS[1], 1, 365)).toBe(7);
  expect(convertBookingValue(0, NOTICE_UNITS[2], 0, 10080)).toBe(0);
  expect(storedBookingValue(1.5, MINUTE_UNITS[1])).toBe(90);
  expect(storedBookingValue(2.3, DAY_UNITS[0])).toBe(2);
  expect(storedBookingValue(1.234, MINUTE_UNITS[1])).toBe(74);
  expect(automaticBookingUnit(59, NOTICE_UNITS).id).toBe('minutes');
  expect(automaticBookingUnit(60, NOTICE_UNITS).id).toBe('hours');
  expect(automaticBookingUnit(90, MINUTE_UNITS).id).toBe('hours');
  expect(automaticBookingUnit(1439, NOTICE_UNITS).id).toBe('hours');
  expect(automaticBookingUnit(1440, NOTICE_UNITS).id).toBe('days');
  expect(automaticBookingUnit(1500, NOTICE_UNITS).id).toBe('hours');
  expect(automaticBookingUnit(6, DAY_UNITS).id).toBe('days');
  expect(automaticBookingUnit(7, DAY_UNITS).id).toBe('weeks');
  expect(describeBookingValue(30, DAY_UNITS)).toBe('30 days');
  expect(describeBookingValue(14, DAY_UNITS)).toBe('2 weeks');
});

it('commits rounded units instead of displaying a value different from the draft', async () => {
  const user = userEvent.setup();
  const [value, setValue] = createSignal(30);
  render(() => (
    <BookingValueInput
      label="Booking window"
      value={value()}
      min={1}
      max={365}
      units={DAY_UNITS}
      disabled={false}
      onChange={setValue}
    />
  ));
  const input = screen.getByRole('spinbutton', {
    name: 'Booking window exact value',
  }) as HTMLInputElement;
  const units = screen.getByRole('combobox', { name: 'Booking window units' });
  expect(input.closest('[data-number-unit-input]')?.contains(units)).toBe(true);
  await user.click(units);
  await user.click(screen.getByRole('option', { name: 'Weeks' }));
  expect(value()).toBe(28);
  expect(input.value).toBe('4');
  expect(input.getAttribute('aria-valuemin')).toBe('1');
  expect(input.getAttribute('aria-valuemax')).toBe('52');
  await user.click(units);
  await user.click(screen.getByRole('option', { name: 'Days' }));
  expect(value()).toBe(28);
  expect(input.value).toBe('28');
  setValue(365);
  await user.click(units);
  await user.click(screen.getByRole('option', { name: 'Weeks' }));
  expect(value()).toBe(364);
  expect(input.value).toBe('52');
  // Slider and preset edits return to Auto when whole weeks cannot represent the amount.
  setValue(30);
  expect(input.value).toBe('30');
  expect(unitText(input)).toBe('days');
  expect(units.textContent).toBe('days');
  expect(value()).toBe(30);
});

it('keeps exact duration input free-form in whole minutes while rounding switched hours', async () => {
  const user = userEvent.setup();
  const [value, setValue] = createSignal(17);
  render(() => (
    <BookingValueInput
      label="Duration"
      value={value()}
      min={5}
      max={480}
      units={MINUTE_UNITS}
      disabled={false}
      onChange={setValue}
    />
  ));
  const input = screen.getByRole('spinbutton', {
    name: 'Duration exact value',
  }) as HTMLInputElement;
  expect(input.value).toBe('17');
  fireEvent.focus(input);
  fireEvent.input(input, { target: { value: '19' } });
  fireEvent.blur(input);
  expect(value()).toBe(19);
  expect(input.value).toBe('19');
  const units = screen.getByRole('combobox', { name: 'Duration units' });
  await user.click(units);
  await user.click(screen.getByRole('option', { name: 'Hours' }));
  expect(value()).toBe(19);
  expect(input.value).toBe('0.32');
  // An external 15-minute slider edit keeps the chosen fractional-hour display.
  setValue(75);
  expect(input.value).toBe('1.25');
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  fireEvent.blur(input);
  expect(value()).toBe(76);
});

it('keeps blank, non-finite, and out-of-range exact input out of the draft', async () => {
  const user = userEvent.setup();
  const [value, setValue] = createSignal(30);
  const changed = vi.fn((next: number) => setValue(next));
  render(() => (
    <BookingValueInput
      label="Booking window"
      value={value()}
      min={1}
      max={365}
      units={DAY_UNITS}
      disabled={false}
      onChange={changed}
    />
  ));
  const input = screen.getByRole('spinbutton', {
    name: 'Booking window exact value',
  }) as HTMLInputElement;
  await user.click(
    screen.getByRole('combobox', { name: 'Booking window units' })
  );
  await user.click(screen.getByRole('option', { name: 'Days' }));
  for (const text of ['', '0', '-1', '366', '1e999']) {
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: text } });
    expect(value()).toBe(30);
    expect(changed).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(input.value).toBe('30');
  }
  fireEvent.focus(input);
  fireEvent.input(input, { target: { value: '32.6' } });
  expect(value()).toBe(33);
  fireEvent.blur(input);
  expect(input.value).toBe('33');
});

it('honors explicit selection of the fallback unit instead of reviving an old preference', async () => {
  const user = userEvent.setup();
  const [value, setValue] = createSignal(1440);
  render(() => (
    <BookingValueInput
      label="Minimum notice"
      value={value()}
      min={0}
      max={10080}
      units={NOTICE_UNITS}
      disabled={false}
      onChange={setValue}
    />
  ));
  const input = screen.getByRole('spinbutton', {
    name: 'Minimum notice exact value',
  }) as HTMLInputElement;
  const units = screen.getByRole('combobox', { name: 'Minimum notice units' });
  await user.click(units);
  await user.click(screen.getByRole('option', { name: 'Days' }));
  expect(input.value).toBe('1');
  setValue(1501);
  expect(input.value).toBe('25.02');
  await user.click(units);
  await user.click(screen.getByRole('option', { name: 'Minutes' }));
  setValue(2880);
  expect(input.value).toBe('2880');
  expect(unitText(input)).toBe('min');
  expect(units.textContent).toBe('min');
  expect(value()).toBe(2880);
});

it('upgrades automatic units at thresholds and edits fractions without changing stored precision', () => {
  const [value, setValue] = createSignal(59);
  render(() => (
    <BookingValueInput
      label="Minimum notice"
      value={value()}
      min={0}
      max={10080}
      units={NOTICE_UNITS}
      disabled={false}
      onChange={setValue}
    />
  ));
  const input = screen.getByRole('spinbutton', {
    name: 'Minimum notice exact value',
  }) as HTMLInputElement;
  const units = screen.getByRole('combobox', { name: 'Minimum notice units' });
  expect(input.value).toBe('59');
  expect(unitText(input)).toBe('min');
  expect(units.textContent).toBe('min');
  expect(input.closest('[data-number-unit-input]')?.textContent).not.toContain(
    'Auto'
  );
  setValue(60);
  expect(input.value).toBe('1');
  expect(unitText(input)).toBe('hour');
  setValue(90);
  expect(input.value).toBe('1.5');
  expect(value()).toBe(90);
  fireEvent.focus(input);
  fireEvent.input(input, { target: { value: '1.75' } });
  fireEvent.blur(input);
  expect(value()).toBe(105);
  expect(input.value).toBe('1.75');
  setValue(1440);
  expect(input.value).toBe('1');
  expect(unitText(input)).toBe('day');
  setValue(1501);
  expect(input.value).toBe('25.02');
  expect(unitText(input)).toBe('hours');
  fireEvent.focus(input);
  fireEvent.input(input, { target: { value: input.value } });
  fireEvent.blur(input);
  expect(value()).toBe(1501);
  setValue(59);
  expect(input.value).toBe('59');
  expect(input.getAttribute('aria-valuemin')).toBe('0');
  expect(unitText(input)).toBe('min');
});

it('explicitly reselects Auto after a whole-number manual unit falls back to automatic display', async () => {
  const user = userEvent.setup();
  const [value, setValue] = createSignal(1440);
  render(() => (
    <BookingValueInput
      label="Minimum notice"
      value={value()}
      min={0}
      max={10080}
      units={NOTICE_UNITS}
      disabled={false}
      onChange={setValue}
    />
  ));
  const input = screen.getByRole('spinbutton', {
    name: 'Minimum notice exact value',
  }) as HTMLInputElement;
  const units = screen.getByRole('combobox', { name: 'Minimum notice units' });
  await user.click(units);
  await user.click(screen.getByRole('option', { name: 'Days' }));
  setValue(1501);
  expect(input.value).toBe('25.02');
  expect(unitText(input)).toBe('hours');
  await user.click(units);
  await user.click(screen.getByRole('option', { name: 'Auto' }));
  setValue(2880);
  expect(input.value).toBe('2');
  expect(unitText(input)).toBe('days');
  expect(value()).toBe(2880);
});

it('keeps fractional hours valid at the maximum and whole minutes valid at the minimum', () => {
  const [value, setValue] = createSignal(479);
  render(() => (
    <BookingValueInput
      label="Duration"
      value={value()}
      min={5}
      max={479}
      units={MINUTE_UNITS}
      disabled={false}
      onChange={setValue}
    />
  ));
  const input = screen.getByRole('spinbutton', {
    name: 'Duration exact value',
  }) as HTMLInputElement;
  expect(input.value).toBe('7.98');
  expect(input.validity.valid).toBe(true);
  fireEvent.focus(input);
  fireEvent.input(input, { target: { value: input.value } });
  fireEvent.blur(input);
  expect(value()).toBe(479);
  expect(input.validity.valid).toBe(true);
  setValue(5);
  expect(input.value).toBe('5');
  expect(input.validity.valid).toBe(true);
});

it('uses at most two decimals for hours and keeps every other unit whole', () => {
  expect(displayBookingValue(61, MINUTE_UNITS[1])).toBe(1.02);
  expect(displayBookingValue(125, MINUTE_UNITS[1])).toBe(2.08);
  expect(displayBookingValue(90, MINUTE_UNITS[1])).toBe(1.5);
  expect(displayBookingValue(30, DAY_UNITS[0])).toBe(30);
  expect(displayBookingValue(14, DAY_UNITS[1])).toBe(2);
  expect(describeBookingValue(1501, NOTICE_UNITS)).toBe('25.02 hours');
  expect(describeBookingValue(2880, NOTICE_UNITS)).toBe('2 days');
  expect(describeBookingValue(15, DAY_UNITS)).toBe('15 days');
  const bookings = {
    id: 'bookings',
    label: 'Bookings',
    short: 'bookings',
    factor: 1,
  };
  expect(displayBookingValue(5, bookings)).toBe(5);
  expect(storedBookingValue(2.6, bookings)).toBe(3);
});

it('preserves durations below the first 15-minute slider tick without mutating the draft', () => {
  const [duration, setDuration] = createSignal(5);
  const changes = vi.fn((value: number) => setDuration(value));
  render(() => (
    <BookingValueSlider
      label="Duration"
      value={duration()}
      min={5}
      max={480}
      unit="min"
      units={MINUTE_UNITS}
      sliderStep={15}
      disabled={false}
      onChange={changes}
    />
  ));
  const input = screen.getByRole('spinbutton', {
    name: 'Duration exact value',
  }) as HTMLInputElement;
  const sliders = screen.getAllByRole('slider', { name: 'Duration' });
  const thumb = sliders.find((slider) => slider.tagName !== 'INPUT');
  const range = sliders.find(
    (slider) => slider.tagName === 'INPUT'
  ) as HTMLInputElement;
  if (!thumb) throw new Error('Duration thumb did not render');
  for (let minutes = 5; minutes < 15; minutes++) {
    setDuration(minutes);
    expect(input.value).toBe(String(minutes));
    expect(thumb.getAttribute('aria-valuenow')).toBe(String(minutes));
    expect(thumb.getAttribute('aria-valuetext')).toBe(`${minutes} minutes`);
    expect(thumb.getAttribute('aria-valuemin')).toBe('5');
    expect(range.value).toBe(String(minutes));
    expect(duration()).toBe(minutes);
  }
  expect(changes).not.toHaveBeenCalled();
  setDuration(5);
  thumb.focus();
  fireEvent.keyDown(thumb, { key: 'Home' });
  fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
  expect(duration()).toBe(5);
  expect(changes).not.toHaveBeenCalled();
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  expect(duration()).toBe(15);
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  expect(duration()).toBe(30);
  fireEvent.keyDown(thumb, { key: 'Home' });
  expect(duration()).toBe(5);
  expect(range.value).toBe('5');
});

it('uses one-minute Ctrl keyboard adjustments without snapping the draft when Ctrl is released', () => {
  const [value, setValue] = createSignal(30);
  render(() => (
    <BookingValueSlider
      label="Duration"
      value={value()}
      min={5}
      max={480}
      unit="min"
      units={MINUTE_UNITS}
      sliderStep={15}
      disabled={false}
      onChange={setValue}
    />
  ));
  const thumb = screen
    .getAllByRole('slider', { name: 'Duration' })
    .find((element) => element.tagName !== 'INPUT')!;
  thumb.focus();
  fireEvent.keyDown(thumb, { key: 'Control', ctrlKey: true });
  fireEvent.keyDown(thumb, { key: 'ArrowRight', ctrlKey: true });
  expect(value()).toBe(31);
  fireEvent.keyDown(thumb, { key: 'ArrowRight', ctrlKey: true });
  expect(value()).toBe(32);
  fireEvent.keyUp(thumb, { key: 'Control', ctrlKey: false });
  expect(value()).toBe(32);
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  expect(value()).toBe(45);
  fireEvent.keyDown(thumb, { key: 'Home', ctrlKey: true });
  expect(value()).toBe(5);
  fireEvent.keyDown(thumb, { key: 'ArrowRight', ctrlKey: true });
  expect(value()).toBe(6);
});

it('supports Ctrl changes during a duration drag and follows the thumb with its current-value hint', async () => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  const [value, setValue] = createSignal(30);
  render(() => (
    <BookingValueSlider
      label="Duration"
      value={value()}
      min={5}
      max={480}
      unit="min"
      units={MINUTE_UNITS}
      sliderStep={15}
      disabled={false}
      onChange={setValue}
    />
  ));
  const thumb = screen
    .getAllByRole('slider', { name: 'Duration' })
    .find((element) => element.tagName !== 'INPUT')!;
  let captured = false;
  for (
    let element: HTMLElement | null = thumb;
    element && element !== document.body;
    element = element.parentElement
  ) {
    Object.assign(element, {
      setPointerCapture: () => {
        captured = true;
      },
      hasPointerCapture: () => captured,
      releasePointerCapture: () => {
        captured = false;
      },
    });
  }
  const track = thumb.parentElement!;
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 480, 8)
  );
  fireEvent.pointerDown(thumb, { clientX: 30, button: 0 });
  fireEvent.pointerMove(thumb, { clientX: 45 });
  expect(value()).toBe(45);
  fireEvent.keyDown(document, { key: 'Control', ctrlKey: true });
  fireEvent.pointerMove(thumb, { clientX: 46, ctrlKey: true });
  expect(value()).toBe(46);
  fireEvent.pointerMove(thumb, { clientX: 47, ctrlKey: true });
  expect(value()).toBe(47);
  const hint = await screen.findByRole('tooltip');
  expect(hint.textContent).toContain('47');
  expect(thumb.getAttribute('aria-describedby')?.split(' ')).toContain(hint.id);
  expect(hint.className).toContain('pointer-events-none');
  expect(track.className).toContain('mb-5');
  expect(hint.className).toContain('absolute');
  expect(hint.className).toContain('bg-tooltip');
  fireEvent.keyUp(document, { key: 'Control' });
  expect(value()).toBe(47);
  fireEvent.pointerMove(thumb, { clientX: 60 });
  expect(value()).toBe(60);
  fireEvent.pointerMove(thumb, { clientX: 65, ctrlKey: true });
  expect(value()).toBe(65);
  expect(hint.textContent).toBe('1 hour 5 mins');
  fireEvent.pointerUp(thumb, { clientX: 65 });
});

it('keeps timing controls visible and preserves custom selections', async () => {
  const user = userEvent.setup();
  const [draft, setDraft] = createSignal(
    newEventType('hours', ['user'], false)
  );
  render(() => (
    <BookingRuleSliders
      onDailyLimitEnabled={() => {}}
      draft={draft()}
      disabled={false}
      onUpdate={(key, value) =>
        setDraft((current) => ({ ...current, [key]: value }))
      }
      onBuffers={(beforeMinutes, afterMinutes) =>
        setDraft((current) => ({ ...current, beforeMinutes, afterMinutes }))
      }
    />
  ));
  expect(screen.getAllByRole('spinbutton')).toHaveLength(4);
  expect(screen.queryByRole('slider')).toBeNull();
  expect(
    screen.getByRole('region', { name: 'Meeting times guests can choose' })
  ).toBeTruthy();
  expect(
    screen.getByRole('region', { name: 'Time between meetings' })
  ).toBeTruthy();
  expect((bookingRuleInput('Meeting buffers') as HTMLInputElement).value).toBe(
    '0'
  );
  for (const label of ['Minimum notice', 'Booking window', 'Meeting buffers']) {
    expect(bookingRuleInput(label)).toBeTruthy();
  }
  for (const [label, value] of [
    ['Time-slot interval', '30 min'],
    ['Daily booking limit', 'No limit'],
  ]) {
    expect(bookingRuleSelect(label).textContent).toContain(value);
    expect(
      screen.queryByRole('spinbutton', { name: `${label} exact value` })
    ).toBeNull();
    expect(
      screen.queryByRole('group', { name: `${label} presets` })
    ).toBeNull();
    await selectBookingRule(user, label, 'Custom');
    const exact = bookingRuleInput(label);
    await waitFor(() => expect(document.activeElement).toBe(exact));
    expect(bookingRuleSelect(label).textContent).toContain('Custom');
  }
  const input = bookingRuleInput('From');
  expect(screen.queryByRole('button', { name: 'Decrease from' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Increase from' })).toBeNull();
  await user.click(input);
  fireEvent.input(input, { target: { value: '2' } });
  fireEvent.blur(input);
  expect(draft().noticeMinutes).toBe(120);
  expect(bookingRuleInput('From')).toBe(input);
  await user.click(
    screen.getByRole('combobox', {
      name: "What's the earliest someone can book? units",
    })
  );
  await user.click(screen.getByRole('option', { name: 'Days' }));
  await user.click(input);
  fireEvent.input(input, { target: { value: '1' } });
  fireEvent.blur(input);
  expect(draft().noticeMinutes).toBe(1440);
  expect(draft().horizonDays).toBe(60);
  expect(bookingRuleInput('From')).toBe(input);
});

it('selects Custom for manual duration edits even when they match a preset', () => {
  const [value, setValue] = createSignal(30);
  render(() => (
    <BookingValueSlider
      label="Duration"
      value={value()}
      min={5}
      max={480}
      unit="min"
      units={MINUTE_UNITS}
      sliderStep={15}
      disabled={false}
      presets={[
        { value: 15, label: '15 min' },
        { value: 30, label: '30 min' },
      ]}
      onChange={setValue}
    />
  ));
  const presets = within(
    screen.getByRole('group', { name: 'Duration presets' })
  );
  expect(
    presets.getByRole('button', { name: '30 min' }).getAttribute('aria-pressed')
  ).toBe('true');
  expect(
    screen.queryByRole('spinbutton', { name: 'Duration exact value' })
  ).toBeNull();
  expect(screen.queryByRole('slider', { name: 'Duration' })).toBeNull();
  expect(presets.getByRole('button', { name: '30 min' }).className).toContain(
    'h-8'
  );
  for (const choice of presets.getAllByRole('button')) {
    const selected = choice.getAttribute('aria-pressed') === 'true';
    expect(choice.classList.contains('rounded-full')).toBe(true);
    expect(
      choice.classList.contains('not-touch:not-disabled:hover:text-ink')
    ).toBe(false);
    expect(
      choice.classList.contains('not-touch:not-disabled:hover:text-current')
    ).toBe(false);
    expect(choice.className).toContain(
      selected
        ? 'not-touch:not-disabled:hover:text-accent'
        : 'not-touch:not-disabled:hover:text-ink-muted'
    );
    expect(choice.className).toContain(
      'not-touch:not-disabled:hover:overlay-hover'
    );
  }
  fireEvent.click(presets.getByRole('button', { name: 'Custom' }));
  expect(
    presets.getByRole('button', { name: 'Custom' }).getAttribute('aria-pressed')
  ).toBe('true');
  expect(screen.getAllByRole('slider', { name: 'Duration' })).not.toHaveLength(
    0
  );
  expect(screen.getAllByText('Duration')).toHaveLength(1);
  const thumb = screen
    .getAllByRole('slider', { name: 'Duration' })
    .find((slider) => slider.tagName !== 'INPUT');
  expect(thumb?.parentElement?.className).toContain('bg-ink/15');
  expect(thumb?.parentElement?.className).toContain('shrink-0');
  const input = screen.getByRole('spinbutton', {
    name: 'Duration exact value',
  });
  expect(input.classList.contains('px-3')).toBe(true);
  expect(input.style.width).toContain('1.5rem');
  for (const label of ['Decrease duration', 'Increase duration']) {
    expect(
      screen.getByRole('button', { name: label }).classList.contains('size-9')
    ).toBe(true);
  }
  const inputFrame = input.closest('[data-number-unit-input]');
  if (!inputFrame) throw new Error('Missing number input frame');
  expect(
    inputFrame.compareDocumentPosition(
      presets.getByRole('button', { name: 'Custom' })
    ) & Node.DOCUMENT_POSITION_PRECEDING
  ).toBeTruthy();
  fireEvent.focus(input);
  fireEvent.input(input, { target: { value: '30' } });
  fireEvent.blur(input);
  expect(
    presets.getByRole('button', { name: 'Custom' }).getAttribute('aria-pressed')
  ).toBe('true');
  expect(value()).toBe(30);
  fireEvent.click(presets.getByRole('button', { name: '15 min' }));
  expect(
    presets.getByRole('button', { name: '15 min' }).getAttribute('aria-pressed')
  ).toBe('true');
  expect(value()).toBe(15);
  expect(screen.queryByRole('slider', { name: 'Duration' })).toBeNull();
});

it('changes before and after meeting values independently without changing duration', () => {
  const [draft, setDraft] = createSignal(
    newEventType('hours', ['user'], false)
  );
  render(() => (
    <BookingRuleSliders
      onDailyLimitEnabled={() => {}}
      draft={draft()}
      disabled={false}
      onUpdate={() => {}}
      onBuffers={(beforeMinutes, afterMinutes) =>
        setDraft((current) => ({ ...current, beforeMinutes, afterMinutes }))
      }
    />
  ));
  const before = screen.getByRole('spinbutton', {
    name: 'Before each meeting exact value',
  });
  const after = screen.getByRole('spinbutton', {
    name: 'After each meeting exact value',
  });
  fireEvent.input(before, { target: { value: '120' } });
  fireEvent.blur(before);
  expect(draft().beforeMinutes).toBe(120);
  expect(draft().afterMinutes).toBe(0);
  fireEvent.input(after, { target: { value: '60' } });
  fireEvent.blur(after);
  expect(draft().beforeMinutes).toBe(120);
  expect(draft().afterMinutes).toBe(60);
  fireEvent.input(before, { target: { value: '0' } });
  fireEvent.blur(before);
  expect(draft().beforeMinutes).toBe(0);
  expect(draft().afterMinutes).toBe(60);
  expect(draft().durationMinutes).toBe(30);
  const section = screen.getByRole('region', { name: 'Time between meetings' });
  expect(section.contains(before)).toBe(true);
  expect(section.contains(after)).toBe(true);
  const buffers = before.closest('.grid')!;
  expect(buffers.classList.contains('grid-cols-2')).toBe(true);
  expect(buffers.classList.contains('gap-x-6')).toBe(true);
  expect(buffers.classList.contains('sm:gap-x-8')).toBe(true);
  expect(buffers.contains(after)).toBe(true);
  expect(
    screen
      .getByRole('group', { name: 'Booking range' })
      .classList.contains('sm:gap-x-8')
  ).toBe(true);
  const frequency = screen.getByRole('region', { name: 'Booking frequency' });
  expect(frequency.classList.contains('gap-x-6')).toBe(true);
  expect(frequency.classList.contains('sm:gap-x-8')).toBe(true);
  for (const input of [
    before,
    after,
    bookingRuleInput('From'),
    bookingRuleInput('To'),
  ]) {
    const frame = input.closest('[data-number-unit-input]');
    expect(frame?.classList.contains('w-full')).toBe(false);
    expect(frame?.classList.contains('flex-1')).toBe(false);
  }
  expect(screen.queryByRole('slider')).toBeNull();
  expect(bookingRuleSelect('Time-slot interval')).toBeTruthy();
});

it('removes the booking-rule draft explanation and remove actions', async () => {
  const user = userEvent.setup();
  workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  const editor = screen.getByRole('dialog', {
    name: 'New personal booking link',
  });
  await advanceEditor(user, 3);
  expect(
    within(editor).queryByText(
      'Changes stay in this draft until you save the link.'
    )
  ).toBeNull();
  expect(
    within(editor).queryByRole('button', { name: /Remove Booking rules/i })
  ).toBeNull();
  await user.click(within(editor).getByRole('button', { name: 'Back' }));
  expect(
    within(editor).queryByRole('button', { name: /Remove Booking rules/i })
  ).toBeNull();
});

it('keeps buffer inputs disabled and exposes inline validation errors', () => {
  const [disabled, setDisabled] = createSignal(false);
  const onBuffers = vi.fn();
  render(() => (
    <BookingRuleSliders
      onDailyLimitEnabled={() => {}}
      draft={newEventType('hours', ['user'], false)}
      disabled={disabled()}
      issues={[
        { field: 'beforeMinutes', message: 'Invalid buffer before.' },
        { field: 'afterMinutes', message: 'Invalid buffer after.' },
      ]}
      onUpdate={() => {}}
      onBuffers={onBuffers}
    />
  ));
  fireEvent.click(bookingRuleInput('Meeting buffers'));
  for (const label of ['Before each meeting', 'After each meeting']) {
    const input = screen.getByRole('spinbutton', {
      name: `${label} exact value`,
    });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(
      document.getElementById(
        input.getAttribute('aria-describedby')!.split(' ').at(-1)!
      )?.textContent
    ).toContain('Invalid buffer');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('10080');
  }
  setDisabled(true);
  expect(bookingRuleInput('Meeting buffers').hasAttribute('disabled')).toBe(
    true
  );
  expect(
    screen
      .getAllByRole('spinbutton')
      .every((input) => input.hasAttribute('disabled'))
  ).toBe(true);
  expect(bookingRuleInput('Meeting buffers').getAttribute('aria-invalid')).toBe(
    'true'
  );
  expect(onBuffers).not.toHaveBeenCalled();
});

it.each(
  [
    {
      edited: 'beforeMinutes' as const,
      untouched: 'afterMinutes' as const,
      editedLabel: 'Before each meeting',
      untouchedLabel: 'After each meeting',
    },
    {
      edited: 'afterMinutes' as const,
      untouched: 'beforeMinutes' as const,
      editedLabel: 'After each meeting',
      untouchedLabel: 'Before each meeting',
    },
  ].flatMap((pair) =>
    [-10, Number.NaN, Number.POSITIVE_INFINITY, 10081].map((value) => ({
      ...pair,
      value,
    }))
  )
)(
  'preserves invalid $untouched ($value) when editing $edited',
  ({ edited, untouched, editedLabel, untouchedLabel, value }) => {
    let editor!: ReturnType<typeof createEventEditor>;
    render(() => {
      editor = createEventEditor({
        event: {
          ...newEventType('hours', ['user'], false),
          title: 'Intro call',
          [untouched]: value,
        },
        events: () => [],
        missingHosts: () => [],
        hasSchedule: () => true,
        createActive: () => false,
        onSave: async () => {},
      });
      editor.goToStep('rules');
      editor.next();
      return (
        <BookingRuleSliders
          draft={editor.draft()}
          issues={editor.issues()}
          disabled={false}
          onUpdate={editor.update}
          onBuffers={editor.updateBuffers}
          onDailyLimitEnabled={editor.setDailyLimitEnabled}
        />
      );
    });
    fireEvent.click(bookingRuleInput('Meeting buffers'));
    const untouchedInput = screen.getByRole('spinbutton', {
      name: `${untouchedLabel} exact value`,
    });
    expect(untouchedInput.getAttribute('aria-invalid')).toBe('true');
    const editedInput = screen.getByRole('spinbutton', {
      name: `${editedLabel} exact value`,
    });
    fireEvent.input(editedInput, { target: { value: '15' } });
    fireEvent.blur(editedInput);
    expect(editor.draft()[edited]).toBe(15);
    expect(editor.draft()[untouched]).toBe(value);
    expect(editor.issues()).toContainEqual(
      expect.objectContaining({ field: untouched })
    );
    expect(untouchedInput.getAttribute('aria-invalid')).toBe('true');
    editor.next();
    expect(editor.step()).toBe('rules');
  }
);

it('edits location, availability, and questions in their steps without saving early', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  const editor = screen.getByRole('dialog', {
    name: 'New personal booking link',
  });
  const form = within(editor);
  expect(
    form.queryByRole('group', { name: 'Meeting location presets' })
  ).toBeNull();
  expect(form.queryByRole('button', { name: 'Add a question' })).toBeNull();
  await advanceEditor(user, 1);
  const locationEdit = form.queryByRole('button', {
    name: 'Edit meeting location',
  });
  if (locationEdit) await user.click(locationEdit);
  const presets = within(
    form.getByRole('group', { name: 'Meeting location presets' })
  );
  expect(
    presets
      .getByRole('button', { name: 'Google Meet' })
      .getAttribute('aria-pressed')
  ).toBe('true');
  expect(
    presets
      .getByRole('button', { name: 'Google Meet' })
      .querySelector('svg')
      ?.getAttribute('aria-hidden')
  ).toBe('true');
  for (const choice of presets.getAllByRole('button')) {
    const selected = choice.getAttribute('aria-pressed') === 'true';
    expect(choice.classList.contains('rounded-full')).toBe(true);
    expect(choice.classList.contains('bg-accent-bg')).toBe(false);
    expect(
      choice.classList.contains(selected ? 'text-accent' : 'text-ink-muted')
    ).toBe(true);
    expect(
      choice.classList.contains('not-touch:not-disabled:hover:text-ink')
    ).toBe(false);
    expect(
      choice.classList.contains('not-touch:not-disabled:hover:text-current')
    ).toBe(false);
    expect(choice.className).toContain(
      selected
        ? 'not-touch:not-disabled:hover:text-accent'
        : 'not-touch:not-disabled:hover:text-ink-muted'
    );
  }
  await user.click(presets.getByRole('button', { name: 'Custom' }));
  const location = form.getByRole('textbox', {
    name: 'Location or meeting URL',
  }) as HTMLInputElement;
  fireEvent.input(location, { target: { value: 'Main office' } });
  await user.click(form.getByRole('button', { name: 'Next' }));
  expect(
    form.queryByRole('textbox', { name: 'Location or meeting URL' })
  ).toBeNull();
  await user.click(form.getByRole('button', { name: 'Back' }));
  expect(form.getByRole('textbox', { name: 'Location or meeting URL' })).toBe(
    location
  );
  expect(location.value).toBe('Main office');
  await user.click(presets.getByRole('button', { name: 'Google Meet' }));
  const availabilityEdit = form.queryByRole('button', {
    name: 'Edit availability',
  });
  if (availabilityEdit) await user.click(availabilityEdit);
  expect(
    form.getByRole('button', { name: /^Availability schedule/ })
  ).toBeTruthy();
  expect(
    form.queryByText('Availability schedule', { selector: 'span' })
  ).toBeNull();
  await user.click(form.getByRole('button', { name: 'Next' }));
  await user.click(form.getByRole('button', { name: 'Add a question' }));
  fireEvent.input(form.getByRole('textbox', { name: 'Question 1' }), {
    target: { value: 'What are we discussing?' },
  });
  await advanceEditor(user, 2);
  expect(form.getByText('What are we discussing?')).toBeTruthy();
  expect(saves).not.toHaveBeenCalled();
});

it('shows weekly hours below availability and keeps calendar exclusion help by availability', async () => {
  const user = userEvent.setup();
  workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  const editor = screen.getByRole('dialog', {
    name: 'New personal booking link',
  });
  const form = within(editor);
  await advanceEditor(user, 1);
  const availabilityEdit = form.queryByRole('button', {
    name: 'Edit availability',
  });
  if (availabilityEdit) await user.click(availabilityEdit);
  const hours = form.getByRole('region', { name: 'Weekly hours' });
  expect(editor.contains(hours)).toBe(true);
  expect(within(hours).getByText('Monday')).toBeTruthy();
  expect(within(hours).getAllByText('09:00–17:00')).toHaveLength(5);
  expect(form.queryByRole('button', { name: 'View weekly hours' })).toBeNull();
  expect(
    form.queryByText(
      'Busy times on connected calendars are excluded automatically.'
    )
  ).toBeNull();
  await user.click(form.getByRole('button', { name: 'About availability' }));
  const help = await screen.findByRole('dialog', {
    name: 'About availability',
  });
  expect(
    within(help).getByText(
      'Busy times on connected calendars are excluded automatically.'
    )
  ).toBeTruthy();
});

it('preserves custom daily limits through No limit and returning to the rules flow', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  await advanceEditor(user, 3);
  expect(
    screen.queryByRole('checkbox', { name: 'Limit bookings per day' })
  ).toBeNull();
  expect(bookingRuleSelect('Daily booking limit').textContent).toContain(
    'No limit'
  );
  expect(
    screen.queryByRole('spinbutton', {
      name: 'Daily booking limit exact value',
    })
  ).toBeNull();
  await selectBookingRule(user, 'Daily booking limit', 'Custom');
  let input = bookingRuleInput('Daily booking limit') as HTMLInputElement;
  expect(input.value).toBe('5');
  fireEvent.input(input, { target: { value: '12' } });
  fireEvent.blur(input);
  await selectBookingRule(user, 'Daily booking limit', 'No limit');
  expect(
    screen.queryByRole('spinbutton', {
      name: 'Daily booking limit exact value',
    })
  ).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Back' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await selectBookingRule(user, 'Daily booking limit', 'Custom');
  input = bookingRuleInput('Daily booking limit') as HTMLInputElement;
  expect(input.value).toBe('12');
  fireEvent.input(input, { target: { value: '19' } });
  fireEvent.blur(input);
  await selectBookingRule(user, 'Daily booking limit', 'No limit');
  await selectBookingRule(user, 'Daily booking limit', 'Custom');
  expect(
    (bookingRuleInput('Daily booking limit') as HTMLInputElement).value
  ).toBe('19');
  expect(saves).not.toHaveBeenCalled();
  await selectBookingRule(user, 'Daily booking limit', '5 bookings');
  expect(bookingRuleSelect('Daily booking limit').textContent).toContain(
    '5 bookings'
  );
  expect(
    screen.queryByRole('spinbutton', {
      name: 'Daily booking limit exact value',
    })
  ).toBeNull();
  await selectBookingRule(user, 'Daily booking limit', 'Custom');
  input = bookingRuleInput('Daily booking limit') as HTMLInputElement;
  fireEvent.input(input, { target: { value: '0' } });
  fireEvent.blur(input);
  await user.click(screen.getByRole('button', { name: 'Next' }));
  const review = document.querySelector<HTMLElement>(
    '[data-booking-step="review"]'
  )!;
  expect(within(review).getByText('No daily limit')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Create link' }));
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(saves.mock.calls[0][1].eventTypes[0].dailyLimit).toBeNull();
});

it('reveals and focuses an invalid zero daily limit even when it matches No limit', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links', { dailyLimit: 0 });
  await user.click(
    screen.getByRole('button', { name: 'Options for Existing link' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
  const editor = within(
    screen.getByRole('dialog', { name: 'Edit booking link' })
  );
  await advanceEditor(user, 3);
  await user.click(editor.getByRole('button', { name: 'Next' }));
  const trigger = bookingRuleInput('Daily booking limit');
  expect(trigger.getAttribute('aria-invalid')).toBe('true');
  expect(editor.getByRole('alert').textContent).toContain('1–100');
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  await focusBookingRule(user, 'Daily booking limit');
  const input = editor.getByRole('spinbutton', {
    name: 'Daily booking limit exact value',
  });
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(saves).not.toHaveBeenCalled();
  await selectBookingRule(user, 'Daily booking limit', 'No limit');
  expect(editor.queryByRole('alert')).toBeNull();
  expect(
    editor.queryByRole('spinbutton', {
      name: 'Daily booking limit exact value',
    })
  ).toBeNull();
  expect(bookingRuleSelect('Daily booking limit').textContent).toContain(
    'No limit'
  );
  await user.click(editor.getByRole('button', { name: 'Next' }));
  await user.click(editor.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(saves.mock.calls[0][1].eventTypes[0].dailyLimit).toBeNull();
});

it('focuses and selects custom preset inputs so typing immediately replaces the preset value', async () => {
  const user = userEvent.setup();
  workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  const duration = within(
    screen.getByRole('group', { name: 'Duration presets' })
  );
  await user.click(duration.getByRole('button', { name: 'Custom' }));
  const durationInput = screen.getByRole('spinbutton', {
    name: 'Duration exact value',
  }) as HTMLInputElement;
  expect(document.activeElement).toBe(durationInput);
  expect(durationInput.selectionStart).toBe(0);
  expect(durationInput.selectionEnd).toBe(durationInput.value.length);
  await user.keyboard('17');
  expect(durationInput.value).toBe('17');
  await advanceEditor(user, 3);
  for (const label of ['From', 'To']) {
    await focusBookingRule(user, label);
    expect(document.activeElement).toBe(bookingRuleInput(label));
    expect(
      screen.queryByRole('group', { name: `${label} presets` })
    ).toBeNull();
  }
  await selectBookingRule(user, 'Time-slot interval', 'Custom');
  const intervalInput = screen.getByRole('spinbutton', {
    name: 'Time-slot interval exact value',
  }) as HTMLInputElement;
  await waitFor(() => expect(document.activeElement).toBe(intervalInput));
  expect(intervalInput.selectionStart).toBe(0);
  expect(intervalInput.selectionEnd).toBe(intervalInput.value.length);
  await user.keyboard('17');
  expect(
    (
      screen.getByRole('spinbutton', {
        name: 'Time-slot interval exact value',
      }) as HTMLInputElement
    ).value
  ).toBe('17');
  await selectBookingRule(user, 'Time-slot interval', '60 min');
  expect(
    screen.queryByRole('spinbutton', { name: 'Time-slot interval exact value' })
  ).toBeNull();
  bookingRuleSelect('Time-slot interval').focus();
  await user.keyboard('{ArrowRight}');
  const keyboardInput = bookingRuleInput(
    'Time-slot interval'
  ) as HTMLInputElement;
  await waitFor(() => expect(document.activeElement).toBe(keyboardInput));
  expect(keyboardInput.selectionStart).toBe(0);
  expect(keyboardInput.selectionEnd).toBe(keyboardInput.value.length);
  expect(keyboardInput.value).toBe('60');
});

it('does not steal focus when a custom input is removed before its queued focus runs', async () => {
  const [value, setValue] = createSignal(30);
  render(() => (
    <BookingValueSlider
      label="Duration"
      value={value()}
      min={5}
      max={480}
      unit="min"
      units={MINUTE_UNITS}
      disabled={false}
      presets={[
        { value: 15, label: '15 min' },
        { value: 30, label: '30 min' },
      ]}
      onChange={setValue}
    />
  ));
  const presets = within(
    screen.getByRole('group', { name: 'Duration presets' })
  );
  fireEvent.click(presets.getByRole('button', { name: 'Custom' }));
  const preset = presets.getByRole('button', { name: '15 min' });
  preset.focus();
  fireEvent.click(preset);
  await Promise.resolve();
  expect(
    screen.queryByRole('spinbutton', { name: 'Duration exact value' })
  ).toBeNull();
  expect(document.activeElement).toBe(preset);
});

it('edits additional Google Meet details without changing the selected location type', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links', {
    googleMeet: true,
    location: 'Use the side entrance',
  });
  await user.click(
    screen.getByRole('button', { name: 'Options for Existing link' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
  const editor = screen.getByRole('dialog', { name: 'Edit booking link' });
  const form = within(editor);
  await advanceEditor(user, 1);
  expect(
    form.queryByRole('button', { name: 'Edit joining instructions' })
  ).toBeNull();
  expect(
    screen.queryByRole('dialog', { name: 'Joining instructions' })
  ).toBeNull();
  const input = form.getByRole('textbox', {
    name: 'Joining instructions',
  }) as HTMLInputElement;
  expect(input.value).toBe('Use the side entrance');
  fireEvent.input(input, { target: { value: 'Ring the bell on arrival' } });
  const locationPresets = within(
    form.getByRole('group', { name: 'Meeting location presets' })
  );
  await user.click(locationPresets.getByRole('button', { name: 'Custom' }));
  expect(
    (
      form.getByRole('textbox', {
        name: 'Location or meeting URL',
      }) as HTMLInputElement
    ).value
  ).toBe('Ring the bell on arrival');
  await user.click(
    locationPresets.getByRole('button', { name: 'Google Meet' })
  );
  expect(
    (
      form.getByRole('textbox', {
        name: 'Joining instructions',
      }) as HTMLInputElement
    ).value
  ).toBe('Ring the bell on arrival');
  expect(
    within(form.getByRole('group', { name: 'Meeting location presets' }))
      .getByRole('button', { name: 'Google Meet' })
      .getAttribute('aria-pressed')
  ).toBe('true');
  await advanceEditor(user, 3);
  await user.click(form.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(saves.mock.calls[0][1].eventTypes[0]).toMatchObject({
    googleMeet: true,
    location: 'Ring the bell on arrival',
  });
});

it('summarizes every changed booking rule instead of unchanged notice and window defaults', () => {
  const event = newEventType('hours', ['user'], false);
  expect(bookingRulesSummary(event)).toBe('No custom rules');
  for (const [change, summary] of [
    [{ beforeMinutes: 15 }, '15 minutes before'],
    [{ afterMinutes: 20 }, '20 minutes after'],
    [{ intervalMinutes: 45 }, '45 minutes interval'],
    [{ dailyLimit: 12 }, '12 bookings per day'],
    [{ dailyLimit: 1 }, '1 booking per day'],
    [{ noticeMinutes: 0 }, 'No minimum notice'],
    [{ noticeMinutes: 1440 }, '1 day notice'],
    [{ horizonDays: 14 }, '2 weeks ahead'],
  ] as const) {
    expect(bookingRulesSummary({ ...event, ...change })).toBe(summary);
  }
  expect(
    bookingRulesSummary({
      ...event,
      beforeMinutes: 15,
      afterMinutes: 20,
      intervalMinutes: 45,
      dailyLimit: 12,
    })
  ).toBe(
    '15 minutes before · 20 minutes after · 45 minutes interval · 12 bookings per day'
  );
});

it('shows current buffer, interval, and limit values in review', async () => {
  const user = userEvent.setup();
  workspaceFixture('links', {
    beforeMinutes: 15,
    afterMinutes: 10,
    intervalMinutes: 45,
    dailyLimit: 12,
  });
  await user.click(
    screen.getByRole('button', { name: 'Options for Existing link' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
  const editor = screen.getByRole('dialog', { name: 'Edit booking link' });
  await advanceEditor(user, 4);
  for (const [label, value] of [
    ['Time between meetings', '15 minutes before · 10 minutes after'],
    ['Time-slot interval', '45 minutes'],
    ['Daily booking limit', '12 bookings per day'],
  ]) {
    expect(
      within(editor)
        .getByText(label, { selector: 'dt' })
        .parentElement?.querySelector('dd')?.textContent
    ).toBe(value);
  }
});

it('walks through five steps, keeps drafts mounted, and saves only after review', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  const editor = screen.getByRole('dialog', {
    name: 'New personal booking link',
  });
  expect(editor.className).toContain('w-full');
  expect(editor.className).toContain('max-w-[min(42rem,calc(100vw-16px))]');
  const form = within(editor);
  const title = form.getByRole('textbox', { name: 'Title' });
  await waitFor(() => expect(document.activeElement).toBe(title));
  expect(title.getAttribute('data-size')).toBe('lg');
  expect(title.classList.contains('sm:text-sm')).toBe(true);
  expect(title.classList.contains('text-base')).toBe(true);
  expect(form.queryByRole('button', { name: 'Save draft' })).toBeNull();
  const heading = within(editor).getByRole('heading', {
    name: 'New personal booking link',
  });
  expect(heading.className).toContain('sr-only');
  expect(editor.querySelector('form')?.contains(heading)).toBe(false);
  expect(form.queryByRole('button', { name: 'Create link' })).toBeNull();
  expect(
    form.getByRole('button', { name: 'Next' }).getAttribute('data-variant')
  ).toBe('cta');
  const header = editor.querySelector<HTMLElement>('header')!;
  expect(header.children).toHaveLength(1);
  expect(header.classList.contains('border-b')).toBe(true);
  expect(header.classList.contains('pt-6')).toBe(true);
  expect(header.classList.contains('pb-4')).toBe(true);
  expect(header.classList.contains('sm:px-6')).toBe(true);
  expect(header.classList.contains('sm:px-8')).toBe(false);
  expectStepProgress(header, 1, 'Meeting details');
  expect(within(header).queryByRole('button')).toBeNull();
  expect(
    form.queryByRole('button', { name: 'Close booking link editor' })
  ).toBeNull();
  expect(form.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  expect(form.queryByRole('button', { name: 'Back' })).toBeNull();
  expect(
    form.queryByRole('button', { name: 'Change booking step' })
  ).toBeNull();
  expect(form.getAllByRole('progressbar')).toHaveLength(1);
  const footer = title.closest('form')!.querySelector('footer')!;
  const cancel = within(footer).getByRole('button', { name: 'Cancel' });
  expect(footer.firstElementChild?.contains(cancel)).toBe(true);
  expect(cancel.closest('[data-booking-primary-actions]')).toBeNull();
  expect(within(footer).queryByRole('button', { name: 'Back' })).toBeNull();
  const rightActions = form
    .getByRole('button', { name: 'Next' })
    .closest<HTMLElement>('[data-booking-primary-actions]')!;
  expect(rightActions.className).toContain('ml-auto');
  expect(rightActions.parentElement).toBe(footer);
  expect(Array.from(footer.children).indexOf(cancel.parentElement!)).toBe(0);
  expect(Array.from(footer.children).indexOf(rightActions)).toBeGreaterThan(0);
  const formElement = title.closest('form')!;
  expect(formElement.className).toContain(
    'h-[min(36rem,calc(100dvh-var(--virtual-keyboard-height,0px)-var(--safe-top,0px)-var(--safe-bottom,0px)-4rem))]'
  );
  const scrollArea = formElement.querySelector<HTMLElement>(
    '[data-booking-scroll-area]'
  )!;
  expect(scrollArea.classList.contains('min-h-0')).toBe(true);
  expect(scrollArea.classList.contains('flex-1')).toBe(true);
  expect(scrollArea.classList.contains('overflow-y-auto')).toBe(true);
  expect(scrollArea.classList.contains('pt-4')).toBe(true);
  expect(scrollArea.classList.contains('py-7')).toBe(false);
  for (const element of [scrollArea, footer]) {
    expect(element.classList.contains('sm:px-6')).toBe(true);
    expect(element.classList.contains('sm:px-8')).toBe(false);
  }
  expect(header.querySelector('h2')).toBeNull();
  expectStepProgress(header, 1, 'Meeting details');
  expect(form.queryByRole('heading', { name: 'Details' })).toBeNull();
  expect(form.getByRole('heading', { name: 'Meeting details' })).toBeTruthy();
  const nextButton = form.getByRole('button', { name: 'Next' });
  expect(nextButton.querySelector('svg')).toBeNull();
  expect(
    form
      .getByRole('heading', { name: 'Meeting details' })
      .closest('[data-booking-scroll-area]')
  ).toBe(scrollArea);
  await user.click(form.getByRole('button', { name: 'Next' }));
  expect(
    document.getElementById(title.getAttribute('aria-describedby') ?? '')
      ?.textContent
  ).toContain('title');
  expect(title.getAttribute('aria-invalid')).toBe('true');
  expect(
    document.getElementById(title.getAttribute('aria-describedby') ?? '')
      ?.textContent
  ).toContain('title');
  await waitFor(() => expect(document.activeElement).toBe(title));
  fireEvent.input(title, { target: { value: 'Intro call' } });
  expect(title.getAttribute('aria-invalid')).not.toBe('true');
  expect(form.queryByRole('alert')).toBeNull();
  fireEvent.input(form.getByRole('textbox', { name: 'Description' }), {
    target: { value: 'Bring a topic.' },
  });
  await user.click(
    within(form.getByRole('group', { name: 'Duration presets' })).getByRole(
      'button',
      { name: 'Custom' }
    )
  );
  const duration = form.getByRole('spinbutton', {
    name: 'Duration exact value',
  }) as HTMLInputElement;
  fireEvent.input(duration, { target: { value: '37' } });
  fireEvent.blur(duration);
  await user.click(form.getByRole('button', { name: 'Next' }));
  expect(form.queryByRole('textbox', { name: 'Title' })).toBeNull();
  expect(
    form.getByRole('heading', { name: 'Location & availability' })
  ).toBeTruthy();
  const availabilityControl = form.getByRole('button', {
    name: /^Availability schedule/,
  });
  expect(availabilityControl.classList.contains('h-9')).toBe(true);
  expect(availabilityControl.classList.contains('rounded-lg')).toBe(true);
  const locations = form.getByRole('group', {
    name: 'Meeting location presets',
  });
  expect(locations.querySelector('[data-slot="button-group"]')).toBeNull();
  expect(
    within(locations)
      .getByRole('button', { name: 'Google Meet' })
      .classList.contains('rounded-full')
  ).toBe(true);
  expect(title.isConnected).toBe(true);
  const back = form.getByRole('button', { name: 'Back' });
  expect(back.hasAttribute('disabled')).toBe(false);
  expect(back.closest('footer')).toBe(footer);
  expect(back.closest('header')).toBeNull();
  expect(rightActions.firstElementChild?.contains(back)).toBe(true);
  expect(back.getAttribute('data-size')).toBe('lg');
  expect(back.querySelector('svg')).toBeNull();
  expect(back.textContent?.trim()).toBe('Back');
  expectStepProgress(header, 2, 'Location & availability');
  await user.click(form.getByRole('button', { name: 'Back' }));
  expect(form.getByRole('textbox', { name: 'Title' })).toBe(title);
  expect(form.getByRole('spinbutton', { name: 'Duration exact value' })).toBe(
    duration
  );
  expect(duration.value).toBe('37');
  await advanceEditor(user, 2);
  expect(form.getByRole('heading', { name: 'Questions' })).toBeTruthy();
  await user.click(form.getByRole('button', { name: 'Add a question' }));
  fireEvent.input(form.getByRole('textbox', { name: 'Question 1' }), {
    target: { value: 'What should we discuss?' },
  });
  await user.click(form.getAllByRole('checkbox', { name: 'Required' })[0]);
  await user.click(form.getByRole('button', { name: 'Next' }));
  expect(form.getByRole('heading', { name: 'Booking rules' })).toBeTruthy();
  const earliest = bookingRuleInput('From');
  await user.click(earliest);
  fireEvent.input(earliest, { target: { value: '0' } });
  fireEvent.blur(earliest);
  await user.click(form.getByRole('button', { name: 'Next' }));
  expect(form.queryByRole('button', { name: 'Next' })).toBeNull();
  const reviewHeading = form.getByRole('heading', {
    name: 'Review',
  });
  expect(reviewHeading.classList.contains('text-2xl')).toBe(true);
  expect(form.getByText('Intro call')).toBeTruthy();
  expect(form.getByText('Intro call').classList.contains('text-xl')).toBe(true);
  expect(form.getByText('Bring a topic.')).toBeTruthy();
  const reviewPanel = formElement.querySelector<HTMLElement>(
    '[data-booking-step="review"]'
  )!;
  expect(reviewPanel.querySelectorAll('dt svg')).toHaveLength(0);
  expect(reviewPanel.querySelectorAll('section')).toHaveLength(3);
  for (const section of reviewPanel.querySelectorAll('section')) {
    expect(section.classList.contains('p-3')).toBe(false);
    expect(section.classList.contains('sm:p-4')).toBe(false);
    expect(section.firstElementChild?.tagName.toLowerCase()).toBe('svg');
  }
  expect(
    within(reviewPanel).queryByRole('heading', { name: 'Meeting details' })
  ).toBeNull();
  expect(
    within(reviewPanel).queryByRole('heading', {
      name: 'Location & availability',
    })
  ).toBeNull();
  expect(
    within(reviewPanel).queryByRole('button', { name: /^Edit / })
  ).toBeNull();
  for (const value of reviewPanel.querySelectorAll('dd')) {
    expect(value.parentElement?.className).toContain('flex-col');
    expect(value.className).not.toContain('text-right');
    expect(value.parentElement?.classList.contains('gap-0.5')).toBe(true);
  }
  const questionHeading = within(reviewPanel).getByRole('heading', {
    name: 'Questions',
  });
  const attendeeDetails = within(reviewPanel).getByRole('button', {
    name: 'About attendee details',
  });
  expect(questionHeading.parentElement?.contains(attendeeDetails)).toBe(true);
  expect(attendeeDetails.querySelector('svg')).not.toBeNull();
  expect(
    within(reviewPanel).queryByText('Name and email are always collected.')
  ).toBeNull();
  await user.click(attendeeDetails);
  const information = screen.getByRole('dialog', {
    name: 'About attendee details',
  });
  expect(
    within(information).getByText('Name and email are always collected.')
  ).toBeTruthy();
  expect(editor.contains(information)).toBe(true);
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'About attendee details' })
    ).toBeNull()
  );
  expect(document.activeElement).toBe(attendeeDetails);
  expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).toBeNull();
  expect(formElement.querySelector('[data-booking-scroll-area]')).toBe(
    scrollArea
  );
  expect(formElement.classList.contains('h-auto')).toBe(true);
  expect(
    formElement.classList.contains(
      'min-h-[min(36rem,calc(100dvh-var(--virtual-keyboard-height,0px)-var(--safe-top,0px)-var(--safe-bottom,0px)-4rem))]'
    )
  ).toBe(true);
  expect(
    formElement.classList.contains(
      'max-h-[calc(100dvh-var(--virtual-keyboard-height,0px)-var(--safe-top,0px)-var(--safe-bottom,0px)-4rem)]'
    )
  ).toBe(true);
  expect(scrollArea.classList.contains('flex-auto')).toBe(true);
  expectStepProgress(header, 5, 'Review');
  expect(saves).not.toHaveBeenCalled();
  for (let index = 0; index < 4; index++) {
    await user.click(form.getByRole('button', { name: 'Back' }));
  }
  expect(form.getByRole('textbox', { name: 'Title' })).toBe(title);
  expect(form.getByRole('spinbutton', { name: 'Duration exact value' })).toBe(
    duration
  );
  expect(formElement.classList.contains('h-auto')).toBe(false);
  expect(
    formElement.classList.contains(
      'h-[min(36rem,calc(100dvh-var(--virtual-keyboard-height,0px)-var(--safe-top,0px)-var(--safe-bottom,0px)-4rem))]'
    )
  ).toBe(true);
  expect(scrollArea.classList.contains('flex-1')).toBe(true);
  await advanceEditor(user, 4);
  const create = form.getByRole('button', { name: 'Create link' });
  expect(create.getAttribute('data-variant')).toBe('cta');
  expect(create.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  expect(rightActions.contains(create)).toBe(true);
  await user.click(create);
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(saves.mock.calls[0][1].eventTypes[0]).toMatchObject({
    title: 'Intro call',
    description: 'Bring a topic.',
    enabled: true,
    durationMinutes: 37,
    noticeMinutes: 0,
    questions: [
      {
        id: expect.any(String),
        label: 'What should we discuss?',
        required: true,
      },
    ],
  });
});

it('shows the selected weekly hours directly below the availability selector', async () => {
  const user = userEvent.setup();
  const morning = { ...newSchedule('UTC'), name: 'Mornings' };
  const afternoon = {
    ...newSchedule('America/New_York'),
    name: 'Afternoons',
    weekly: [{ day: 1, windows: [{ start: '13:00', end: '16:00' }] }],
  };
  render(() => (
    <div class="portal-scope">
      <EventEditor
        event={newEventType(morning.id, ['user'], false)}
        events={[]}
        schedules={[morning, afternoon]}
        members={[]}
        team={false}
        saving={false}
        onSave={async () => {}}
        onCancel={() => {}}
      />
    </div>
  ));
  await advanceEditor(user, 1);
  const availabilityEdit = screen.queryByRole('button', {
    name: 'Edit availability',
  });
  if (availabilityEdit) await user.click(availabilityEdit);
  const hours = screen.getByRole('region', { name: 'Weekly hours' });
  const selector = screen.getByRole('button', {
    name: /^Availability schedule/,
  });
  expect(
    hours.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_PRECEDING
  ).toBeTruthy();
  expect(hours.textContent).toContain('Time zone: UTC');
  await user.click(selector);
  await user.click(screen.getByRole('option', { name: 'Afternoons' }));
  expect(hours.textContent).toContain('Time zone: America/New York');
  expect(within(hours).getByText('13:00–16:00')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Back' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('button', { name: /^Availability schedule/ })).toBe(
    selector
  );
  expect(hours.textContent).toContain('Time zone: America/New York');
  expect(within(hours).getByText('13:00–16:00')).toBeTruthy();
});

it('keeps the inline unit menu local, restores focus, and disables it with its number input', async () => {
  const user = userEvent.setup();
  const [disabled, setDisabled] = createSignal(false);
  const [value, setValue] = createSignal(120);
  const { container } = render(() => (
    <div class="portal-scope">
      <form>
        <BookingValueInput
          label="Minimum notice"
          value={value()}
          min={0}
          max={10080}
          units={NOTICE_UNITS}
          disabled={disabled()}
          onChange={setValue}
        />
      </form>
    </div>
  ));
  const input = screen.getByRole('spinbutton', {
    name: 'Minimum notice exact value',
  });
  const trigger = screen.getByRole('combobox', {
    name: 'Minimum notice units',
  });
  expect(input.closest('[data-number-unit-input]')?.contains(trigger)).toBe(
    true
  );
  await user.click(trigger);
  const list = screen.getByRole('listbox');
  expect(container.querySelector('.portal-scope')?.contains(list)).toBe(true);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  expect(document.activeElement).toBe(trigger);
  expect(value()).toBe(120);
  setDisabled(true);
  expect(input.hasAttribute('disabled')).toBe(true);
  expect(trigger.hasAttribute('disabled')).toBe(true);
  await user.click(trigger);
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(value()).toBe(120);
});

it('shows two optional question fields and omits blank rows from validation, review, and saving', async () => {
  const user = userEvent.setup();
  const schedule = newSchedule('UTC');
  const save = vi.fn(async (_event: EventType) => {});
  render(() => (
    <EventEditor
      event={{
        ...newEventType(schedule.id, ['user'], false),
        title: 'Meeting',
        slug: 'meeting',
      }}
      events={[]}
      schedules={[schedule]}
      members={[]}
      team={false}
      saving={false}
      createActive
      onSave={save}
      onCancel={() => {}}
    />
  ));
  await advanceEditor(user, 2);
  const first = screen.getByRole('textbox', { name: 'Question 1' });
  const second = screen.getByRole('textbox', { name: 'Question 2' });
  expect(screen.getAllByRole('checkbox', { name: 'Required' })).toHaveLength(2);
  expect(
    screen
      .getAllByRole('checkbox', { name: 'Required' })
      .every((input) => !(input as HTMLInputElement).checked)
  ).toBe(true);
  for (const required of screen.getAllByRole('checkbox', {
    name: 'Required',
  })) {
    expect(required.parentElement?.classList.contains('gap-2')).toBe(true);
    expect(required.parentElement?.classList.contains('gap-3')).toBe(false);
    const control = required.nextElementSibling as HTMLElement;
    expect(control.className).toContain('bg-transparent');
    expect(control.className).toContain('data-checked:bg-accent');
  }
  expect(screen.queryByRole('button', { name: 'Remove questions' })).toBeNull();
  const row = first.closest<HTMLElement>('[data-booking-question-row]')!;
  expect(row.className).not.toMatch(/\bp-\d/);
  expect(row.className).not.toContain('border');
  const questionHeading = screen.getByRole('heading', { name: 'Questions' });
  expect(questionHeading.closest('[data-booking-scroll-area]')).not.toBeNull();
  const attendeeNote = screen.getByText('Name and email are always collected.');
  const formElement = first.closest('form')!;
  expect(attendeeNote.hasAttribute('data-booking-attendee-note')).toBe(true);
  expect(attendeeNote.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
    'true'
  );
  expect(attendeeNote.classList.contains('items-center')).toBe(true);
  expect(attendeeNote.nextElementSibling).toBe(
    formElement.querySelector('footer')
  );
  expect(attendeeNote.closest('[data-booking-step]')).toBeNull();
  expect(screen.queryByText(/Leave unused questions blank/i)).toBeNull();
  const controls = row.firstElementChild!;
  expect(
    controls.contains(screen.getAllByRole('checkbox', { name: 'Required' })[0])
  ).toBe(true);
  const remove = screen.getByRole('button', { name: 'Remove question 1' });
  expect(controls.contains(remove)).toBe(true);
  expect(remove.getAttribute('data-size')).toBe('icon-sm');
  expect(remove.querySelector('svg')).not.toBeNull();
  fireEvent.input(second, { target: { value: '   ' } });
  await advanceEditor(user, 2);
  const noQuestions = screen.getByText('No custom questions');
  expect(noQuestions.querySelector('svg')).toBeNull();
  expect(
    noQuestions.closest('section')?.firstElementChild?.tagName.toLowerCase()
  ).toBe('svg');
  await user.click(screen.getByRole('button', { name: 'Create link' }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0]).toMatchObject({
    questions: [],
    enabled: true,
  });
  expect(first.getAttribute('aria-invalid')).not.toBe('true');
  expect(second.getAttribute('aria-invalid')).not.toBe('true');
  expect(screen.queryByRole('alert')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Back' }));
  await user.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.input(first, { target: { value: 'Your topic?' } });
  await user.click(screen.getAllByRole('checkbox', { name: 'Required' })[0]);
  await advanceEditor(user, 2);
  expect(screen.getByText('Your topic?')).toBeTruthy();
  expect(screen.queryByText('No custom questions')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Create link' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][0].questions).toEqual([
    { id: expect.any(String), label: 'Your topic?', required: true },
  ]);
});

it('shows a custom-link error beside the edit control and inside its popover', async () => {
  const user = userEvent.setup();
  workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  const editor = within(
    screen.getByRole('dialog', { name: 'New personal booking link' })
  );
  fireEvent.input(editor.getByRole('textbox', { name: 'Title' }), {
    target: { value: 'Meeting' },
  });
  const trigger = editor.getByRole('button', { name: 'Edit link' });
  await user.click(trigger);
  fireEvent.input(screen.getByRole('textbox', { name: 'Custom link' }), {
    target: { value: 'Invalid Link' },
  });
  await user.keyboard('{Escape}');
  await user.click(editor.getByRole('button', { name: 'Next' }));
  expect(trigger.getAttribute('aria-invalid')).toBe('true');
  expect(
    document.getElementById(trigger.getAttribute('aria-describedby') ?? '')
      ?.textContent
  ).toContain('lowercase');
  await user.click(trigger);
  const input = screen.getByRole('textbox', { name: 'Custom link' });
  expect(input.getAttribute('aria-invalid')).toBe('true');
  fireEvent.input(input, { target: { value: 'custom-meeting' } });
  expect(input.getAttribute('aria-invalid')).not.toBe('true');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('focuses an invalid manual rule input and keeps it visible after correction', async () => {
  const user = userEvent.setup();
  workspaceFixture('links', { horizonDays: 0 });
  await user.click(
    screen.getByRole('button', { name: 'Options for Existing link' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
  const editor = within(
    screen.getByRole('dialog', { name: 'Edit booking link' })
  );
  await advanceEditor(user, 3);
  await user.click(editor.getByRole('button', { name: 'Next' }));
  const trigger = bookingRuleInput('Booking window');
  expect(trigger.getAttribute('aria-invalid')).toBe('true');
  expect(editor.getByRole('alert').textContent).toContain('1–365');
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  await focusBookingRule(user, 'Booking window');
  const input = editor.getByRole('spinbutton', {
    name: "What's the latest someone can book? exact value",
  });
  expect(input.getAttribute('aria-invalid')).toBe('true');
  await user.click(input);
  fireEvent.input(input, { target: { value: '30' } });
  expect(editor.queryByRole('alert')).toBeNull();
  expect(
    editor.getByRole('spinbutton', {
      name: "What's the latest someone can book? exact value",
    })
  ).toBe(input);
  expect(document.activeElement).toBe(input);
});

it('places save failures under the action that requested the save', async () => {
  const user = userEvent.setup();
  const schedule = newSchedule('UTC');
  const event = {
    ...newEventType(schedule.id, ['user'], false),
    title: 'Meeting',
    slug: 'meeting',
  };
  const save = vi.fn(async () => {
    throw new Error('Could not reach the server.');
  });
  render(() => (
    <EventEditor
      event={event}
      events={[]}
      schedules={[schedule]}
      members={[]}
      team={false}
      saving={false}
      createActive
      onSave={save}
      onCancel={() => {}}
    />
  ));
  expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
  await advanceEditor(user, 4);
  const create = screen.getByRole('button', { name: 'Create link' });
  await user.click(create);
  const submitError = await screen.findByRole('alert');
  expect(submitError.parentElement?.contains(create)).toBe(true);
  expect(create.getAttribute('aria-invalid')).toBe('true');
  expect(submitError.className).not.toContain('bg-failure');
});

it('shows a deleted schedule error under the availability picker before saving', async () => {
  const user = userEvent.setup();
  const schedule = newSchedule('UTC');
  const event = {
    ...newEventType('deleted-schedule', ['user'], false),
    title: 'Meeting',
    slug: 'meeting',
  };
  const save = vi.fn(async () => {});
  render(() => (
    <EventEditor
      event={event}
      events={[]}
      schedules={[schedule]}
      members={[]}
      team={false}
      saving={false}
      createActive
      onSave={save}
      onCancel={() => {}}
    />
  ));
  await advanceEditor(user, 1);
  await user.click(screen.getByRole('button', { name: 'Next' }));
  const picker = screen.getByRole('button', { name: /^Availability schedule/ });
  expect(picker.getAttribute('aria-invalid')).toBe('true');
  expect(
    document.getElementById(picker.getAttribute('aria-describedby') ?? '')
      ?.textContent
  ).toContain('availability schedule');
  expect(save).not.toHaveBeenCalled();
  await waitFor(() => expect(document.activeElement).toBe(picker));
  await user.click(picker);
  await user.click(screen.getByRole('option', { name: schedule.name }));
  expect(picker.getAttribute('aria-invalid')).not.toBe('true');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('keeps schedule errors visible with an injected availability control', async () => {
  const user = userEvent.setup();
  const schedule = newSchedule('UTC');
  const event = {
    ...newEventType('deleted', ['user'], false),
    title: 'Meeting',
    slug: 'meeting',
  };
  render(() => (
    <EventEditor
      event={event}
      events={[]}
      schedules={[schedule]}
      members={[]}
      team={false}
      saving={false}
      createActive
      availability={<button type="button">Choose hours</button>}
      onSave={async () => {}}
      onCancel={() => {}}
    />
  ));
  await advanceEditor(user, 1);
  await user.click(screen.getByRole('button', { name: 'Next' }));
  const group = screen.getByRole('group', { name: 'Availability schedule' });
  expect(group.getAttribute('aria-invalid')).toBe('true');
  expect(within(group).getByRole('alert').textContent).toContain(
    'availability'
  );
  expect(
    within(group).getByRole('button', { name: 'Choose hours' })
  ).toBeTruthy();
});

it('keeps personal host configuration failures visible beneath Next', async () => {
  const user = userEvent.setup();
  const schedule = newSchedule('UTC');
  const event = {
    ...newEventType(schedule.id, [], false),
    title: 'Meeting',
    slug: 'meeting',
  };
  render(() => (
    <EventEditor
      event={event}
      events={[]}
      schedules={[schedule]}
      members={[]}
      team={false}
      saving={false}
      onSave={async () => {}}
      onCancel={() => {}}
    />
  ));
  await advanceEditor(user, 1);
  const next = screen.getByRole('button', { name: 'Next' });
  await user.click(next);
  expect(next.getAttribute('aria-invalid')).toBe('true');
  expect(
    document.getElementById(next.getAttribute('aria-describedby') ?? '')
      ?.textContent
  ).toContain('host');
  expect(screen.queryByRole('button', { name: 'Add a question' })).toBeNull();
});

it('focuses the invalid availability picker after implicit submission from joining instructions, including retries', async () => {
  const user = userEvent.setup();
  const schedule = newSchedule('UTC');
  const event = {
    ...newEventType('deleted-schedule', ['user'], false),
    title: 'Meeting',
    slug: 'meeting',
  };
  render(() => (
    <EventEditor
      event={event}
      events={[]}
      schedules={[schedule]}
      members={[]}
      team={false}
      saving={false}
      onSave={async () => {}}
      onCancel={() => {}}
    />
  ));
  await advanceEditor(user, 1);
  const valid = screen.getByRole('textbox', { name: 'Joining instructions' });
  const invalid = screen.getByRole('button', {
    name: /^Availability schedule/,
  });
  const form = valid.closest('form') as HTMLFormElement;
  valid.focus();
  fireEvent.submit(form);
  await waitFor(() => expect(document.activeElement).toBe(invalid));
  valid.focus();
  fireEvent.input(valid, { target: { value: 'Ring the bell.' } });
  expect(document.activeElement).toBe(valid);
  fireEvent.submit(form);
  await waitFor(() => expect(document.activeElement).toBe(invalid));
  expect(screen.queryByRole('button', { name: 'Add a question' })).toBeNull();
});

it('scrolls the focused error into view when Next validates a booking rule', async () => {
  const user = userEvent.setup();
  const schedule = newSchedule('UTC');
  const event = {
    ...newEventType(schedule.id, ['user'], false),
    title: 'Meeting',
    slug: 'meeting',
    dailyLimit: 101,
  };
  const { container } = render(() => (
    <EventEditor
      event={event}
      events={[]}
      schedules={[schedule]}
      members={[]}
      team={false}
      saving={false}
      createActive
      onSave={async () => {}}
      onCancel={() => {}}
    />
  ));
  const trigger = container.querySelector<HTMLInputElement>(
    'input[aria-label="Daily booking limit exact value"]'
  );
  if (!trigger) throw new Error('Expected the retained daily-limit input.');
  const focus = vi.spyOn(trigger, 'focus');
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollIntoView'
  );
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scroll,
  });
  try {
    await advanceEditor(user, 3);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(focus).toHaveBeenCalledWith({ preventScroll: false });
    const message = screen.getByRole('alert');
    expect(message.textContent).toContain('1–100');
    expect(scroll.mock.contexts).toContain(message);
    expect(scroll).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    });
  } finally {
    focus.mockRestore();
    if (original)
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  }
});

it('returns with Back even when an earlier schedule disappears without weakening timeline guards', () => {
  const save = vi.fn();
  const [editor, setAvailable, dispose] = createRoot((dispose) => {
    const [available, setAvailable] = createSignal(true);
    return [
      createEventEditor({
        event: {
          ...newEventType('hours', ['user'], false),
          title: 'Meeting',
          slug: 'meeting',
        },
        events: () => [],
        hasSchedule: () => available(),
        missingHosts: () => [],
        createActive: () => true,
        onSave: save,
      }),
      setAvailable,
      dispose,
    ] as const;
  });
  try {
    editor.goToStep('review');
    expect(editor.step()).toBe('review');
    setAvailable(false);
    expect(editor.canGoToStep('rules')).toBe(false);
    editor.goToStep('rules');
    expect(editor.step()).toBe('review');
    editor.back();
    expect(editor.step()).toBe('rules');
    editor.next();
    expect(editor.step()).toBe('location');
    expect(editor.issues()).toContainEqual(
      expect.objectContaining({ field: 'scheduleId' })
    );
    editor.back();
    expect(editor.step()).toBe('details');
    expect(save).not.toHaveBeenCalled();
  } finally {
    dispose();
  }
});

it('copies only the saved booking URL beside the review title without saving pending URL edits', async () => {
  const user = userEvent.setup();
  const { saves, copies } = workspaceFixture('links', {
    title: 'Intro call',
    slug: 'intro-call',
  });
  await user.click(
    screen.getByRole('button', { name: 'Options for Intro call' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
  fireEvent.input(screen.getByRole('textbox', { name: 'Title' }), {
    target: { value: 'Renamed call' },
  });
  await user.click(screen.getByRole('button', { name: 'Edit link' }));
  fireEvent.input(screen.getByRole('textbox', { name: 'Custom link' }), {
    target: { value: 'not-saved-yet' },
  });
  await user.keyboard('{Escape}');
  await advanceEditor(user, 4);
  const copy = screen.getByRole('button', { name: 'Copy booking link' });
  expect(
    copy.closest('[data-booking-review-title]')?.querySelector('p')?.textContent
  ).toBe('Renamed call');
  const review = copy.closest<HTMLElement>('[data-booking-step="review"]')!;
  expect(within(review).queryByText('/book/personal/not-saved-yet')).toBeNull();
  await user.click(copy);
  expect(copies).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'personal' }),
    'intro-call'
  );
  expect(saves).not.toHaveBeenCalled();
});

it('shows review copy failures inline and allows retrying without saving', async () => {
  const user = userEvent.setup();
  const { saves, copies } = workspaceFixture('links', {
    title: 'Intro call',
    slug: 'intro-call',
  });
  copies.mockRejectedValueOnce(new Error('Clipboard blocked'));
  await user.click(
    screen.getByRole('button', { name: 'Options for Intro call' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
  await advanceEditor(user, 4);
  const copy = screen.getByRole('button', { name: 'Copy booking link' });
  await user.click(copy);
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Could not copy booking link'
  );
  expect(copy.getAttribute('aria-invalid')).toBe('true');
  await user.click(copy);
  expect(copies).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(saves).not.toHaveBeenCalled();
});

it('tracks saved-value changes while ignoring navigation, blank questions, and reverted edits', () => {
  const event = newEventType('hours', ['user'], false);
  const [editor, dispose] = createRoot(
    (dispose) =>
      [
        createEventEditor({
          event,
          events: () => [],
          hasSchedule: () => true,
          missingHosts: () => [],
          createActive: () => true,
          onSave: async () => {},
        }),
        dispose,
      ] as const
  );
  try {
    expect(editor.hasChanges()).toBe(false);
    editor.next();
    expect(editor.hasChanges()).toBe(false);
    editor.setTitle('Meeting');
    expect(editor.hasChanges()).toBe(true);
    editor.setTitle('');
    expect(editor.hasChanges()).toBe(false);
    editor.update('questions', [{ id: 'blank', label: '  ', required: true }]);
    expect(editor.hasChanges()).toBe(false);
    editor.update('questions', [
      { id: 'blank', label: 'Topic?', required: true },
    ]);
    expect(editor.hasChanges()).toBe(true);
    editor.update('questions', []);
    expect(editor.hasChanges()).toBe(false);
    editor.update('slug', 'custom-link');
    expect(editor.hasChanges()).toBe(true);
    editor.update('slug', '');
    expect(editor.hasChanges()).toBe(false);
    editor.updateBuffers(15, 0);
    expect(editor.hasChanges()).toBe(true);
    editor.updateBuffers(event.beforeMinutes, event.afterMinutes);
    expect(editor.hasChanges()).toBe(false);
  } finally {
    dispose();
  }
});

it('closes an untouched new link without confirmation or saving', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links');
  const opener = screen.getByRole('button', { name: 'New booking link' });
  await user.click(opener);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(saves).not.toHaveBeenCalled();
  await waitFor(() => expect(document.activeElement).toBe(opener));
});

it.each([false, true])(
  'confirms discarded edits and restores focus after Keep editing and Discard with mobile=%s',
  async (mobile) => {
    device.mobile = mobile;
    const user = userEvent.setup();
    const { saves } = workspaceFixture('links');
    const opener = screen.getByRole('button', { name: 'New booking link' });
    await user.click(opener);
    if (mobile)
      fireEvent.transitionEnd(
        screen.getByRole('dialog', { name: 'New personal booking link' })
      );
    const title = screen.getByRole('textbox', {
      name: 'Title',
    }) as HTMLInputElement;
    fireEvent.input(title, { target: { value: 'Unsaved meeting' } });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancel);
    const confirmation = await screen.findByRole('dialog', {
      name: 'Discard changes?',
    });
    expect(saves).not.toHaveBeenCalled();
    await user.click(
      within(confirmation).getByRole('button', { name: 'Keep editing' })
    );
    if (mobile) fireEvent.transitionEnd(confirmation);
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Discard changes?' })
      ).toBeNull()
    );
    expect(screen.getByRole('textbox', { name: 'Title' })).toBe(title);
    expect(title.value).toBe('Unsaved meeting');
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    await user.click(cancel);
    const secondConfirmation = screen.getByRole('dialog', {
      name: 'Discard changes?',
    });
    await user.click(
      within(secondConfirmation).getByRole('button', {
        name: 'Discard changes',
      })
    );
    if (mobile) {
      // The parent remains mounted until the confirmation releases its focus trap.
      expect(title.isConnected).toBe(true);
      fireEvent.transitionEnd(secondConfirmation);
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(saves).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(opener));
    await user.click(opener);
    expect(
      (screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement).value
    ).toBe('');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  }
);

it('uses the discard guard for Escape and dismisses only the confirmation on a second Escape', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  const title = screen.getByRole('textbox', {
    name: 'Title',
  }) as HTMLInputElement;
  fireEvent.input(title, { target: { value: 'Unsaved meeting' } });
  await user.keyboard('{Escape}');
  expect(
    await screen.findByRole('dialog', { name: 'Discard changes?' })
  ).toBeTruthy();
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Discard changes?' })
    ).toBeNull()
  );
  expect(
    screen.getByRole('dialog', { name: 'New personal booking link' })
  ).toBeTruthy();
  expect(title.value).toBe('Unsaved meeting');
  expect(saves).not.toHaveBeenCalled();
});

it('confirms edits before dismissing the booking dialog from outside', async () => {
  const user = userEvent.setup();
  workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  fireEvent.input(screen.getByRole('textbox', { name: 'Title' }), {
    target: { value: 'Unsaved meeting' },
  });
  const dialog = screen.getByRole('dialog', {
    name: 'New personal booking link',
  });
  fireEvent.pointerDown(dialog.parentElement!, {
    button: 0,
    pointerType: 'mouse',
  });
  expect(
    await screen.findByRole('dialog', { name: 'Discard changes?' })
  ).toBeTruthy();
});

it('does not prompt for unchanged existing values after visiting each step', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links', {});
  await user.click(
    screen.getByRole('button', { name: 'Options for Existing link' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
  await advanceEditor(user, 4);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(saves).not.toHaveBeenCalled();
});

it('blocks dialog closing and discard confirmation while saving', async () => {
  const user = userEvent.setup();
  const schedule = newSchedule('UTC');
  const [saving, setSaving] = createSignal(false);
  const cancel = vi.fn();
  render(() => (
    <EventEditor
      event={newEventType(schedule.id, ['user'], false)}
      events={[]}
      schedules={[schedule]}
      members={[]}
      team={false}
      saving={saving()}
      dialogTitle="New booking link"
      onSave={async () => {}}
      onCancel={cancel}
    />
  ));
  fireEvent.input(screen.getByRole('textbox', { name: 'Title' }), {
    target: { value: 'Meeting' },
  });
  setSaving(true);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).toBeNull();
  expect(cancel).not.toHaveBeenCalled();
  setSaving(false);
  await user.keyboard('{Escape}');
  expect(
    await screen.findByRole('dialog', { name: 'Discard changes?' })
  ).toBeTruthy();
  setSaving(true);
  expect(
    screen
      .getByRole('button', { name: 'Discard changes' })
      .hasAttribute('disabled')
  ).toBe(true);
  await user.keyboard('{Escape}');
  expect(screen.getByRole('dialog', { name: 'Discard changes?' })).toBeTruthy();
  expect(cancel).not.toHaveBeenCalled();
});

it.each([
  [0, 10, '10 minutes after'],
  [15, 0, '15 minutes before'],
  [15, 10, '15 minutes before · 10 minutes after'],
  [0, 0, 'No buffers'],
] as const)(
  'omits zero buffer values in Review (%i before, %i after)',
  (before, after, expected) => {
    render(() => (
      <EventReview
        draft={{
          ...newEventType('hours', ['user'], false),
          beforeMinutes: before,
          afterMinutes: after,
        }}
        members={[]}
        team={false}
        active
        saving={false}
      />
    ));
    const label = screen.getByText('Time between meetings');
    const value = label.parentElement!.querySelector('dd')!;
    expect(value.textContent).toBe(expected);
    expect(value.textContent).not.toMatch(/(?:^| · )0 minutes/);
  }
);

it('offers no copy action for a new or duplicated link before it is saved', async () => {
  const user = userEvent.setup();
  const { saves, copies } = workspaceFixture('links', {});
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  fireEvent.input(screen.getByRole('textbox', { name: 'Title' }), {
    target: { value: 'Not yet created' },
  });
  await advanceEditor(user, 4);
  expect(
    screen.queryByRole('button', { name: 'Copy booking link' })
  ).toBeNull();
  expect(copies).not.toHaveBeenCalled();
  expect(saves).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Discard changes' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await user.click(
    screen.getByRole('button', { name: 'Options for Existing link' })
  );
  await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
  await advanceEditor(user, 4);
  expect(
    screen.queryByRole('button', { name: 'Copy booking link' })
  ).toBeNull();
  expect(copies).not.toHaveBeenCalled();
  expect(saves).not.toHaveBeenCalled();
});

it('does not close a replacement editor from a disposed mobile discard confirmation', async () => {
  device.mobile = true;
  const user = userEvent.setup();
  const { setSearch, saves } = workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  fireEvent.input(screen.getByRole('textbox', { name: 'Title' }), {
    target: { value: 'Old draft' },
  });
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  const confirmation = screen.getByRole('dialog', { name: 'Discard changes?' });
  await user.click(
    within(confirmation).getByRole('button', { name: 'Discard changes' })
  );
  setSearch('tab', 'availability');
  setSearch('tab', 'links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  const title = screen.getByRole('textbox', {
    name: 'Title',
  }) as HTMLInputElement;
  fireEvent.input(title, { target: { value: 'Replacement draft' } });
  // A detached closing drawer cannot apply its old owner's close callback.
  fireEvent.transitionEnd(confirmation);
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Discard changes?' })
    ).toBeNull()
  );
  expect(screen.getByRole('textbox', { name: 'Title' })).toBe(title);
  expect(title.value).toBe('Replacement draft');
  expect(saves).not.toHaveBeenCalled();
});

it('aligns every Review icon in one gutter and indents all section content', () => {
  const { container } = render(() => (
    <EventReview
      draft={{
        ...newEventType('hours', ['user'], false),
        title: 'Intro call',
        questions: [{ id: 'topic', label: 'Topic', required: false }],
      }}
      members={[]}
      team={false}
      active
      saving={false}
    />
  ));
  const sections = container.querySelectorAll('section');
  expect(sections).toHaveLength(3);
  for (const section of sections) {
    expect(section.classList.contains('grid')).toBe(true);
    expect(
      section.classList.contains('grid-cols-[1.25rem_minmax(0,1fr)]')
    ).toBe(true);
    expect(section.children).toHaveLength(2);
    const [icon, content] = section.children;
    expect(icon.tagName.toLowerCase()).toBe('svg');
    expect(icon.classList.contains('size-5')).toBe(true);
    expect(content.querySelector('dl')).not.toBeNull();
    expect(content.querySelector('dl')?.querySelector('svg')).toBeNull();
  }
});

it('retains explicit range units after dismissing the unit menu and editing the other endpoint', async () => {
  const user = userEvent.setup();
  const [draft, setDraft] = createSignal(
    newEventType('hours', ['user'], false)
  );
  render(() => (
    <div class="portal-scope">
      <BookingRuleSliders
        draft={draft()}
        disabled={false}
        onUpdate={(key, value) =>
          setDraft((current) => ({ ...current, [key]: value }))
        }
        onBuffers={() => {}}
        onDailyLimitEnabled={() => {}}
      />
    </div>
  ));
  const input = bookingRuleInput('From') as HTMLInputElement;
  const range = await focusBookingRule(user, 'From');
  await user.clear(input);
  await user.type(input, '3');
  await user.click(
    within(range).getByRole('combobox', {
      name: "What's the earliest someone can book? units",
    })
  );
  await user.click(screen.getByRole('option', { name: 'Minutes' }));
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  expect(input.value).toBe('180');
  expect(bookingRuleInput('From')).toBe(input);
  await user.click(bookingRuleInput('To'));
  const reopened = await focusBookingRule(user, 'From');
  expect(reopened).toBe(range);
  expect(input.value).toBe('180');
  expect(unitText(input)).toBe('min');
  expect(draft().noticeMinutes).toBe(180);
  expect(draft().horizonDays).toBe(60);
  expect(document.activeElement).toBe(input);
});

it('does not advance or save when Enter is pressed in a visible rule input', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  await advanceEditor(user, 3);
  const range = await focusBookingRule(user, 'From');
  const input = bookingRuleInput('From');
  await user.clear(input);
  await user.keyboard('3{Enter}');
  expectStepProgress(
    screen.getByRole('dialog', { name: 'New personal booking link' }),
    4,
    'Booking rules'
  );
  expect(range.contains(input)).toBe(true);
  expect(screen.queryByRole('button', { name: 'Create link' })).toBeNull();
  expect(saves).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  expect(
    await screen.findByRole('dialog', { name: 'Discard changes?' })
  ).toBeTruthy();
});

it('preserves independent notice and window values without imposing ordering', () => {
  const [draft, setDraft] = createSignal({
    ...newEventType('hours', ['user'], false),
    noticeMinutes: 10080,
    horizonDays: 1,
  });
  render(() => (
    <BookingRuleSliders
      draft={draft()}
      disabled={false}
      onUpdate={() => {}}
      onBuffers={() => {}}
      onDailyLimitEnabled={() => {}}
    />
  ));
  expect((bookingRuleInput('From') as HTMLInputElement).value).toBe('7');
  expect(unitText(bookingRuleInput('From'))).toBe('days');
  expect((bookingRuleInput('To') as HTMLInputElement).value).toBe('1');
  expect(draft().noticeMinutes).toBe(10080);
  expect(draft().horizonDays).toBe(1);
  setDraft((current) => ({ ...current, horizonDays: 10 }));
  expect((bookingRuleInput('To') as HTMLInputElement).value).toBe('10');
});

it('disables every visible rule input and select', async () => {
  const user = userEvent.setup();
  const onUpdate = vi.fn();
  render(() => (
    <BookingRuleSliders
      draft={newEventType('hours', ['user'], false)}
      disabled
      onUpdate={onUpdate}
      onBuffers={() => {}}
      onDailyLimitEnabled={() => {}}
    />
  ));
  for (const label of [
    'From',
    'To',
    'Before each meeting',
    'After each meeting',
  ]) {
    const input = bookingRuleInput(label);
    expect(input.hasAttribute('disabled')).toBe(true);
    await user.click(input);
  }
  for (const label of ['Time-slot interval', 'Daily booking limit']) {
    const select = bookingRuleSelect(label);
    expect(select.hasAttribute('disabled')).toBe(true);
    await user.click(select);
  }
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(
    screen
      .getAllByRole('spinbutton')
      .every((input) => input.hasAttribute('disabled'))
  ).toBe(true);
  expect(screen.queryByRole('slider')).toBeNull();
  expect(
    screen.getAllByRole('button').every((button) => button.matches(':disabled'))
  ).toBe(true);
  expect(onUpdate).not.toHaveBeenCalled();
});

function timelineRulesFixture(initial: Partial<EventType> = {}) {
  const [draft, setDraft] = createSignal({
    ...newEventType('hours', ['user'], false),
    ...initial,
  });
  render(() => (
    <BookingRuleSliders
      draft={draft()}
      disabled={false}
      onUpdate={(key, value) =>
        setDraft((current) => ({ ...current, [key]: value }))
      }
      onBuffers={(beforeMinutes, afterMinutes) =>
        setDraft((current) => ({ ...current, beforeMinutes, afterMinutes }))
      }
      onDailyLimitEnabled={() => {}}
    />
  ));
  return draft;
}

it('edits booking limits and buffers through exact inputs without sliders', () => {
  const draft = timelineRulesFixture({
    beforeMinutes: 17,
    afterMinutes: 23,
    horizonDays: 10,
  });
  const notice = bookingRuleInput('From');
  fireEvent.focus(notice);
  fireEvent.input(notice, { target: { value: '2.02' } });
  fireEvent.blur(notice);
  expect(draft().noticeMinutes).toBe(121);
  expect(draft().horizonDays).toBe(10);
  const before = bookingRuleInput('Meeting buffers');
  fireEvent.input(before, { target: { value: '18' } });
  fireEvent.blur(before);
  expect(draft().beforeMinutes).toBe(18);
  expect(draft().afterMinutes).toBe(23);
  const after = bookingRuleInput('After each meeting');
  fireEvent.input(after, { target: { value: '24' } });
  fireEvent.blur(after);
  expect(draft().beforeMinutes).toBe(18);
  expect(draft().afterMinutes).toBe(24);
  const window = bookingRuleInput('To');
  fireEvent.input(window, { target: { value: '11' } });
  fireEvent.blur(window);
  expect(draft().horizonDays).toBe(11);
  expect(draft().noticeMinutes).toBe(121);
  fireEvent.input(window, { target: { value: '365' } });
  fireEvent.blur(window);
  expect(draft().horizonDays).toBe(365);
  fireEvent.input(window, { target: { value: '1' } });
  fireEvent.blur(window);
  expect(draft().horizonDays).toBe(1);
  expect(draft().durationMinutes).toBe(30);
  expect(screen.queryByRole('slider')).toBeNull();
});

it('opens exact saved values without snapping timeline fields and shows invalid fractions verbatim', () => {
  const draft = timelineRulesFixture({
    beforeMinutes: 17,
    afterMinutes: 10080,
    horizonDays: 1.4,
  });
  expect((bookingRuleInput('Meeting buffers') as HTMLInputElement).value).toBe(
    '17'
  );
  expect((bookingRuleInput('Booking window') as HTMLInputElement).value).toBe(
    '1.4'
  );
  expect(
    (bookingRuleInput('After each meeting') as HTMLInputElement).value
  ).toBe('10080');
  expect(draft().beforeMinutes).toBe(17);
  expect(draft().afterMinutes).toBe(10080);
  expect(draft().horizonDays).toBe(1.4);
});

it('shows independent endpoint validation errors inside the shared range frame', () => {
  const event = {
    ...newEventType('hours', ['user'], false),
    noticeMinutes: -1,
    horizonDays: 0,
  };
  render(() => (
    <BookingRuleSliders
      draft={event}
      disabled={false}
      issues={[
        { field: 'noticeMinutes', message: 'Notice must be 0–10,080 minutes.' },
        { field: 'horizonDays', message: 'Window must be 1–365 days.' },
      ]}
      onUpdate={() => {}}
      onBuffers={() => {}}
      onDailyLimitEnabled={() => {}}
    />
  ));
  const range = screen.getByRole('group', { name: 'Booking range' });
  for (const [label, message] of [
    ['From', 'Notice must be 0–10,080 minutes.'],
    ['To', 'Window must be 1–365 days.'],
  ]) {
    const input = bookingRuleInput(label);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const alert = within(range).getByText(message);
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(
      alert.id
    );
  }
});

it('shows exact values for long meeting breaks and renders no sliders', () => {
  const draft = timelineRulesFixture({
    beforeMinutes: 6000,
    afterMinutes: 7000,
  });
  expect(screen.queryByRole('slider')).toBeNull();
  expect((bookingRuleInput('Meeting buffers') as HTMLInputElement).value).toBe(
    '6000'
  );
  expect(
    (bookingRuleInput('After each meeting') as HTMLInputElement).value
  ).toBe('7000');
  expect(draft().beforeMinutes).toBe(6000);
  expect(draft().afterMinutes).toBe(7000);
});

it.each([
  ['en-US', false, true],
  ['en-US', true, false],
  ['ar-AE', false, false],
  ['ar-AE', true, true],
] as const)(
  'aligns %s timeline marks, thumb, and arrow keys with reverse=%s',
  (locale, reverse, increasingRight) => {
    const [value, setValue] = createSignal(17);
    const { container } = render(() => (
      <I18nProvider locale={locale}>
        <BookingRuleTimeline
          label="Buffer"
          value={value()}
          landmarks={BUFFER_TIMELINE}
          marks={['0', '30m', '2h', '1d', '7d']}
          disabled={false}
          reverse={reverse}
          onChange={setValue}
        />
      </I18nProvider>
    ));
    const thumb = screen.getByRole('slider', { name: 'Buffer' });
    const marks = container.querySelector('[aria-hidden="true"]')!;
    expect((marks.firstElementChild as HTMLElement).style.left).toBe(
      increasingRight ? '0%' : '100%'
    );
    expect((marks.lastElementChild as HTMLElement).style.left).toBe(
      increasingRight ? '100%' : '0%'
    );
    expect(thumb.style.transform).toBe(
      increasingRight ? 'translateX(-50%)' : 'translateX(50%)'
    );
    expect(thumb.style[increasingRight ? 'left' : 'right']).not.toBe('');
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(value()).toBe(increasingRight ? 18 : 16);
    fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
    expect(value()).toBe(17);
  }
);

it('validates reversed booking ranges without showing the removed header or timeline preview', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  await advanceEditor(user, 3);
  expect(screen.queryByText('When can someone book?')).toBeNull();
  expect(screen.queryByText('For a guest visiting now')).toBeNull();
  expect(document.querySelector('[data-booking-range-preview]')).toBeNull();
  await user.click(
    screen.getByRole('combobox', {
      name: "What's the earliest someone can book? units",
    })
  );
  await user.click(screen.getByRole('option', { name: 'Days' }));
  const from = bookingRuleInput('From');
  fireEvent.input(from, { target: { value: '7' } });
  fireEvent.blur(from);
  const to = bookingRuleInput('To');
  fireEvent.input(to, { target: { value: '1' } });
  fireEvent.blur(to);
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(
    screen.getByText('The booking window must extend beyond the notice period.')
  ).toBeTruthy();
  expect(to.getAttribute('aria-invalid')).toBe('true');
  await waitFor(() => expect(document.activeElement).toBe(to));
  expect((from as HTMLInputElement).value).toBe('7');
  expect((to as HTMLInputElement).value).toBe('1');
  expect(saves).not.toHaveBeenCalled();
  fireEvent.input(to, { target: { value: '8' } });
  fireEvent.blur(to);
  expect(to.getAttribute('aria-invalid')).not.toBe('true');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(screen.getByRole('button', { name: 'Create link' }));
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(saves.mock.calls[0][1].eventTypes[0]).toMatchObject({
    noticeMinutes: 10080,
    horizonDays: 8,
  });
});
