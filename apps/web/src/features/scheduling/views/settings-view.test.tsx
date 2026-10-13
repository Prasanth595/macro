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
} from '../context/scheduling-context';
import {
  BOOKING_RANGE_TIMELINE,
  BUFFER_TIMELINE,
  bookingTimelinePosition,
} from '../core/booking-rule-timeline';
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

function mockSliderPointer(thumb: HTMLElement, width: number) {
  vi.spyOn(thumb.parentElement!, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, width, 8)
  );
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

function bookingThumb(label: string) {
  const name =
    label.includes('earliest') || label === 'From'
      ? 'Booking range Earliest booking time'
      : label.includes('latest') || label === 'To'
        ? 'Booking range Latest booking time'
        : `${label} ${label}`;
  return screen.getByRole('slider', { name });
}

function expectStepProgress(
  container: HTMLElement,
  step: number,
  heading: string
) {
  const progress = within(container).getByRole('progressbar', {
    name: 'Booking setup progress',
  });
  expect(progress.getAttribute('aria-valuemin')).toBe('0');
  expect(progress.getAttribute('aria-valuemax')).toBe('5');
  expect(progress.getAttribute('aria-valuenow')).toBe(String(step));
  expect(progress.getAttribute('aria-valuetext')).toBe(
    `Step ${step} of 5: ${heading}`
  );
  expect(progress.classList.contains('h-2')).toBe(true);
  expect(progress.classList.contains('w-16')).toBe(true);
  expect(progress.classList.contains('sm:w-20')).toBe(true);
  expect(progress.children).toHaveLength(1);
  expect(progress.querySelector('[data-booking-progress-segment]')).toBeNull();
  const fill = progress.firstElementChild as HTMLElement;
  expect(fill.getAttribute('aria-hidden')).toBe('true');
  expect(fill.style.width).toBe(`${(step / 5) * 100}%`);
  return progress;
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
  expect(
    within(header).getByRole('heading', { name: 'Meeting details' })
  ).toBeTruthy();
  const currentHeading = form.getByRole('heading', {
    name: 'Meeting details',
  });
  expect(currentHeading.parentElement).toBe(header);
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
    expect(currentHeading.parentElement).toBe(header);
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

it('keeps step subheadings smaller and more muted than entered values', async () => {
  const user = userEvent.setup();
  workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  const dialog = screen.getByRole('dialog', {
    name: 'New personal booking link',
  });
  const form = within(dialog);
  const expectMutedLabel = (element: HTMLElement) => {
    expect(element.classList.contains('text-sm')).toBe(true);
    expect(element.classList.contains('font-normal')).toBe(true);
    expect(element.classList.contains('text-ink-muted')).toBe(true);
  };
  expect(
    form.getByRole('heading', { name: 'Meeting details' }).className
  ).toContain('text-xl');
  for (const label of ['Title', 'Description', 'Duration']) {
    expectMutedLabel(form.getByText(label));
  }
  expect(form.getByRole('textbox', { name: 'Title' }).className).not.toContain(
    'text-ink-muted'
  );
  await advanceEditor(user, 1);
  for (const label of ['Meeting location', 'Availability']) {
    expectMutedLabel(form.getByRole('heading', { name: label }));
  }
  await advanceEditor(user, 1);
  await user.click(form.getByRole('button', { name: 'Add a question' }));
  expectMutedLabel(form.getByText('Question 1'));
  fireEvent.input(form.getByRole('textbox', { name: 'Question 1' }), {
    target: { value: 'What should we discuss?' },
  });
  await advanceEditor(user, 1);
  for (const label of [
    'Booking range',
    'Time between meetings',
    'Before each meeting',
    'After each meeting',
    'Time-slot interval',
    'Daily booking limit',
  ]) {
    expectMutedLabel(form.getByText(label));
  }
  await advanceEditor(user, 1);
  const review = within(
    dialog.querySelector<HTMLElement>('[data-booking-step="review"]')!
  );
  for (const label of ['Questions', 'Booking rules']) {
    expectMutedLabel(review.getByRole('heading', { name: label }));
  }
});

it('uses contrast-aware borders for multi-step editor dividers and unselected location choices', async () => {
  const user = userEvent.setup();
  workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  const dialog = screen.getByRole('dialog', {
    name: 'New personal booking link',
  });
  const form = dialog.querySelector('form');
  expect(form).toBeTruthy();
  expect(form?.querySelector('header')?.className).not.toContain('border-b');
  const footer = form?.querySelector('footer');
  expect(footer?.className).toContain('border-t');
  expect(footer?.className).toContain('border-edge-frame');
  expect(footer?.className).not.toContain('border-edge-muted');
  await advanceEditor(user, 1);
  const location = screen.getByRole('group', {
    name: 'Meeting location presets',
  });
  const custom = within(location).getByRole('button', { name: 'Custom' });
  expect(custom.className).toContain('border-edge-frame');
  await user.click(custom);
  const googleMeet = within(location).getByRole('button', {
    name: 'Google Meet',
  });
  expect(googleMeet.className).toContain('border-edge-frame');
  await advanceEditor(user, 2);
  for (const name of ['Time between meetings', 'Booking frequency']) {
    const section = screen.getByRole('region', { name });
    expect(section.className).not.toContain('border-t');
    expect(section.className).not.toContain('border-edge-frame');
  }
  await advanceEditor(user, 1);
  for (const name of ['Questions', 'Booking rules']) {
    expect(
      within(dialog).getByRole('heading', { name }).closest('section')
        ?.className
    ).toContain('border-edge-frame');
  }
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
it('previews the public booking page and live drafts without loading bookings', () => {
  const { loadsBookings } = workspaceFixture('page', {
    title: 'Intro meeting',
    durationMinutes: 45,
    description: 'A short introduction.',
  });
  expect(screen.getByRole('heading', { name: 'Booking page' })).toBeTruthy();
  const preview = screen.getByRole('region', { name: 'Booking page preview' });
  expect(
    (
      within(preview).getByRole('textbox', {
        name: 'Display name',
      }) as HTMLInputElement
    ).value
  ).toBe('Personal');
  expect(
    within(preview).getByRole('heading', { name: 'Choose a meeting' })
  ).toBeTruthy();
  expect(
    within(preview).getByRole('heading', { name: 'Intro meeting' })
  ).toBeTruthy();
  expect(within(preview).getByText('45 minutes · Google Meet')).toBeTruthy();
  expect(within(preview).getByText('A short introduction.')).toBeTruthy();
  expect(within(preview).queryByRole('button')).toBeNull();
  fireEvent.input(screen.getByRole('textbox', { name: 'Display name' }), {
    target: { value: 'Personal draft' },
  });
  fireEvent.input(screen.getByRole('textbox', { name: 'Introduction' }), {
    target: { value: 'Welcome to my booking page.' },
  });
  expect(
    (
      within(preview).getByRole('textbox', {
        name: 'Display name',
      }) as HTMLInputElement
    ).value
  ).toBe('Personal draft');
  expect(
    (
      within(preview).getByRole('textbox', {
        name: 'Introduction',
      }) as HTMLTextAreaElement
    ).value
  ).toBe('Welcome to my booking page.');
  expect(screen.queryByRole('button', { name: 'Booking settings' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'New booking link' })).toBeNull();
  expect(loadsBookings.mock.calls).toEqual([
    ['personal', false],
    ['team', false],
  ]);
});

it('switches page modes without discarding drafts and only saves from edit mode', async () => {
  const { saves } = workspaceFixture('page');
  fireEvent.input(screen.getByRole('textbox', { name: 'Display name' }), {
    target: { value: 'Personal draft' },
  });
  fireEvent.input(screen.getByRole('textbox', { name: 'Introduction' }), {
    target: { value: 'Welcome to my booking page.' },
  });
  const modes = screen.getByRole('radiogroup', { name: 'Booking page mode' });
  fireEvent.click(within(modes).getByText('Preview', { exact: true }));
  const preview = screen.getByRole('region', { name: 'Booking page preview' });
  expect(within(preview).queryByRole('textbox')).toBeNull();
  expect(
    within(preview).getByRole('heading', { name: 'Personal draft' })
  ).toBeTruthy();
  expect(within(preview).getByText('Welcome to my booking page.')).toBeTruthy();
  expect(saves).not.toHaveBeenCalled();
  expect(
    screen.queryByRole('button', { name: 'Save booking page' })
  ).toBeNull();
  fireEvent.submit(screen.getByRole('form', { name: 'Booking page details' }));
  expect(saves).not.toHaveBeenCalled();
  fireEvent.click(within(modes).getByText('Edit', { exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Save booking page' }));
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(saves.mock.calls[0][1]).toMatchObject({
    name: 'Personal draft',
    description: 'Welcome to my booking page.',
  });
  expect(
    (
      within(preview).getByRole('textbox', {
        name: 'Display name',
      }) as HTMLInputElement
    ).value
  ).toBe('Personal draft');
  expect(
    (
      within(preview).getByRole('textbox', {
        name: 'Introduction',
      }) as HTMLTextAreaElement
    ).value
  ).toBe('Welcome to my booking page.');
});

it('excludes unpublished booking links from the public page preview', () => {
  workspaceFixture('page', { title: 'Private draft meeting', enabled: false });
  const preview = screen.getByRole('region', { name: 'Booking page preview' });
  expect(within(preview).queryByText('Private draft meeting')).toBeNull();
  expect(
    within(preview).getByText('There are no bookable events right now.')
  ).toBeTruthy();
});

it('guards page submission and locks fields while saving', async () => {
  const { saves, setSaving } = workspaceFixture('page');
  const form = screen.getByRole('form', { name: 'Booking page details' });
  fireEvent.submit(form);
  expect(saves).not.toHaveBeenCalled();
  fireEvent.input(screen.getByRole('textbox', { name: 'Display name' }), {
    target: { value: 'Personal draft' },
  });
  setSaving(true);
  for (const name of ['Display name', 'Introduction']) {
    expect(screen.getByRole('textbox', { name }).hasAttribute('disabled')).toBe(
      true
    );
  }
  expect(
    within(form)
      .getByRole('button', { name: 'Saving booking page' })
      .hasAttribute('disabled')
  ).toBe(true);
  expect(form.getAttribute('aria-busy')).toBe('true');
  fireEvent.submit(form);
  expect(saves).not.toHaveBeenCalled();
  setSaving(false);
  fireEvent.submit(form);
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
});

it('preserves the live page draft after a failed save and allows retry', async () => {
  const { saves } = workspaceFixture('page');
  saves.mockImplementationOnce(() => {
    throw new Error('Could not save booking page.');
  });
  fireEvent.input(screen.getByRole('textbox', { name: 'Display name' }), {
    target: { value: 'Personal draft' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save booking page' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Could not save booking page.'
    )
  );
  const preview = screen.getByRole('region', { name: 'Booking page preview' });
  expect(
    (
      within(preview).getByRole('textbox', {
        name: 'Display name',
      }) as HTMLInputElement
    ).value
  ).toBe('Personal draft');
  expect(
    (screen.getByRole('textbox', { name: 'Display name' }) as HTMLInputElement)
      .value
  ).toBe('Personal draft');
  expect(
    screen
      .getByRole('button', { name: 'Save booking page' })
      .hasAttribute('disabled')
  ).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Save booking page' }));
  await waitFor(() => expect(saves).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Save booking page' })
        .hasAttribute('disabled')
    ).toBe(true)
  );
});

it('saves the selected booking page without changing another owner or losing its draft', async () => {
  const { saves, setSearch } = workspaceFixture('page');
  fireEvent.input(screen.getByRole('textbox', { name: 'Display name' }), {
    target: { value: 'Personal draft' },
  });
  expect(
    (
      within(
        screen.getByRole('region', { name: 'Booking page preview' })
      ).getByRole('textbox', { name: 'Display name' }) as HTMLInputElement
    ).value
  ).toBe('Personal draft');
  setSearch('owner', 'team');
  fireEvent.input(screen.getByRole('textbox', { name: 'Display name' }), {
    target: { value: 'Design meetings' },
  });
  fireEvent.input(screen.getByRole('textbox', { name: 'Introduction' }), {
    target: { value: 'Meet the design team' },
  });
  expect(
    (
      within(
        screen.getByRole('region', { name: 'Booking page preview' })
      ).getByRole('textbox', { name: 'Display name' }) as HTMLInputElement
    ).value
  ).toBe('Design meetings');
  fireEvent.click(screen.getByRole('button', { name: 'Save booking page' }));
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(saves.mock.calls[0]).toEqual([
    'team',
    expect.objectContaining({
      id: 'team',
      name: 'Design meetings',
      description: 'Meet the design team',
    }),
  ]);
  setSearch('owner', 'personal');
  expect(
    (screen.getByRole('textbox', { name: 'Display name' }) as HTMLInputElement)
      .value
  ).toBe('Personal draft');
  expect(
    (
      within(
        screen.getByRole('region', { name: 'Booking page preview' })
      ).getByRole('textbox', { name: 'Display name' }) as HTMLInputElement
    ).value
  ).toBe('Personal draft');
  fireEvent.click(screen.getByRole('button', { name: 'Save booking page' }));
  await waitFor(() => expect(saves).toHaveBeenCalledTimes(2));
  expect(saves.mock.calls[1]).toEqual([
    'personal',
    expect.objectContaining({
      id: 'personal',
      name: 'Personal draft',
      description: '',
    }),
  ]);
});

it('keeps team booking pages read-only while allowing page sharing', async () => {
  const { copies, saves, setSearch } = workspaceFixture('page', undefined, [
    { id: 'personal', name: 'Personal', canEdit: true },
    { id: 'team', name: 'Design', teamId: 'team', canEdit: false },
  ]);
  setSearch('owner', 'team');
  expect(
    screen
      .getByRole('textbox', { name: 'Display name' })
      .hasAttribute('disabled')
  ).toBe(true);
  expect(
    screen
      .getByRole('textbox', { name: 'Introduction' })
      .hasAttribute('disabled')
  ).toBe(true);
  expect(
    screen
      .getByRole('button', { name: 'Save booking page' })
      .hasAttribute('disabled')
  ).toBe(true);
  expect(
    screen.getByText('Only team owners and admins can edit Design scheduling.')
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Copy page link' }));
  await waitFor(() => expect(copies).toHaveBeenCalledOnce());
  expect(copies.mock.calls[0][0].id).toBe('team');
  const pageLink = screen.getByRole('link', { name: 'Preview page' });
  const shareControl = pageLink.closest('[data-slot="button-group"]');
  expect(pageLink.getAttribute('href')).toBe('/book/team/');
  expect(pageLink.textContent).toBe('/book/team/');
  expect(shareControl).not.toBeNull();
  expect(
    screen
      .getByRole('button', { name: 'Copy page link' })
      .closest('[data-slot="button-group"]')
  ).toBe(shareControl);
  expect(shareControl?.querySelector('[role="separator"]')).toBeTruthy();
  expect(saves).not.toHaveBeenCalled();
});

it('does not show success feedback when copying a booking page link fails', async () => {
  const { copies } = workspaceFixture('page');
  copies.mockRejectedValueOnce(new Error('Could not copy booking link'));
  const button = screen.getByRole('button', { name: 'Copy page link' });
  const animate = vi.fn().mockReturnValue({ cancel: vi.fn() });
  Object.defineProperty(button.querySelector('svg')!, 'animate', {
    value: animate,
  });
  fireEvent.click(button);
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Could not copy booking link'
    )
  );
  expect(copies).toHaveBeenCalledOnce();
  expect(animate).not.toHaveBeenCalled();
  expect(button.querySelector('[data-copy-feedback]')).toBeNull();
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
  const loadsBookings = vi.fn();
  const copies = vi
    .fn<SchedulingCapabilities['copyLink']>()
    .mockResolvedValue(undefined);
  const createSource: SchedulingCapabilities['createSource'] = (
    scope,
    _range,
    loadBookings
  ) => {
    loadsBookings(scope().id, loadBookings?.());
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
      <BookingWorkspaceView search={search} onSearchChange={setSearch} />
    </SchedulingProvider>
  ));
  return { search, setSearch, setSaving, saves, copies, loadsBookings };
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

it('keeps single-page sections ordered with consistent spacing and required markers', async () => {
  const user = userEvent.setup();
  workspaceFixture('links');
  await user.click(
    screen.getByRole('button', { name: 'Try single-page editor' })
  );
  const dialog = within(
    screen.getByRole('dialog', { name: 'New personal booking link' })
  );
  const sections = Array.from(
    dialog
      .getByRole('heading', { name: 'Title' })
      .closest('form')
      ?.querySelectorAll<HTMLElement>('[data-booking-editor-section]') ?? []
  );
  expect(
    sections.map((section) => section.querySelector('h3')?.textContent?.trim())
  ).toEqual([
    'Title*',
    'Custom link',
    'Description (optional)',
    'Duration*',
    'Availability*',
    'Meeting link',
    'Booking questions',
    'Booking rules',
  ]);
  for (const section of sections) {
    expect(section.className).toBe(sections[0].className);
    expect(section.className).toContain('gap-1.5');
    expect(section.className).toContain('py-3');
    expect(section.className).toContain('px-5');
    expect(
      section.querySelector('[data-booking-section-heading]')
    ).toBeTruthy();
    const heading = section.querySelector('h3');
    expect(heading?.className).toContain('text-sm');
    expect(heading?.className).toContain('font-normal');
    expect(heading?.className).toContain('text-ink-muted');
  }
  for (const title of ['Title', 'Duration', 'Availability']) {
    const marker = dialog
      .getByRole('heading', { name: title })
      .querySelector('span[aria-hidden="true"]');
    expect(marker?.textContent).toBe('*');
    expect(marker?.className).toContain('text-failure');
  }
  for (const title of ['Custom link', 'Booking questions', 'Booking rules']) {
    const section = dialog
      .getByRole('heading', { name: title })
      .closest('section');
    expect(section?.getAttribute('data-optional-setting')).toBeTruthy();
    expect(section?.querySelector('span[aria-hidden="true"]')).toBeNull();
  }
  expect(dialog.queryByRole('button', { name: 'Next' })).toBeNull();
  expect(
    dialog.getByRole('button', { name: /^Availability schedule/ })
  ).toBeTruthy();
  expect(dialog.queryByRole('region', { name: 'Weekly hours' })).toBeNull();
  for (const name of [
    /^Duration/,
    /^Availability schedule/,
    /^Meeting link type/,
  ]) {
    expect(dialog.getByRole('button', { name }).className).toContain('h-9');
  }
  expect(dialog.getByRole('textbox', { name: 'Title' }).className).toContain(
    'h-9'
  );
  const infoButton = dialog.getByRole('button', {
    name: 'View schedule hours',
  });
  expect(infoButton.className).toContain('size-9');
  await user.click(infoButton);
  const weeklyHours = await dialog.findByRole('region', {
    name: 'Weekly hours',
  });
  expect(within(weeklyHours).getByText('Monday')).toBeTruthy();
  expect(within(weeklyHours).getAllByText('09:00–17:00')).toHaveLength(5);
  await user.keyboard('{Escape}');
  expect(dialog.queryByRole('region', { name: 'Weekly hours' })).toBeNull();
});

it('keeps a live booking link preview below Title when custom editing is collapsed or expanded', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links');
  await user.click(
    screen.getByRole('button', { name: 'Try single-page editor' })
  );
  const dialog = within(
    screen.getByRole('dialog', { name: 'New personal booking link' })
  );
  const preview = dialog.getByRole('status', { name: 'Booking link preview' });
  expect(preview.textContent).toContain('/book/personal/');
  expect(dialog.queryByRole('textbox', { name: 'Custom link' })).toBeNull();
  const title = dialog.getByRole('textbox', { name: 'Title' });
  await user.type(title, 'Coffee chat');
  expect(preview.textContent).toBe('/book/personal/coffee-chat');
  await user.click(dialog.getByRole('button', { name: 'Add custom link' }));
  const customLink = dialog.getByRole('textbox', { name: 'Custom link' });
  await user.clear(customLink);
  await user.type(customLink, 'intro-call');
  expect(preview.textContent).toBe('/book/personal/intro-call');
  await user.clear(title);
  await user.type(title, 'Coffee conversation');
  expect(preview.textContent).toBe('/book/personal/intro-call');
  await user.click(dialog.getByRole('button', { name: 'Remove custom link' }));
  expect(dialog.queryByRole('textbox', { name: 'Custom link' })).toBeNull();
  expect(dialog.getByRole('status', { name: 'Booking link preview' })).toBe(
    preview
  );
  expect(preview.textContent).toBe('/book/personal/coffee-conversation');
  await user.click(dialog.getByRole('button', { name: 'Create link' }));
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(saves.mock.calls[0][1].eventTypes[0]).toMatchObject({
    title: 'Coffee conversation',
    slug: 'coffee-conversation',
  });
});

it('previews the saved booking link without changing it when an existing title changes', async () => {
  const user = userEvent.setup();
  workspaceFixture('links', {});
  await user.click(
    screen.getByRole('button', { name: 'Options for Existing link' })
  );
  await user.click(
    screen.getByRole('menuitem', { name: 'Edit in single-page editor' })
  );
  const dialog = within(
    screen.getByRole('dialog', { name: 'Edit booking link' })
  );
  const preview = dialog.getByRole('status', { name: 'Booking link preview' });
  expect(preview.textContent).toBe('/book/personal/existing-link');
  expect(dialog.queryByRole('textbox', { name: 'Custom link' })).toBeNull();
  const title = dialog.getByRole('textbox', { name: 'Title' });
  await user.clear(title);
  await user.type(title, 'Renamed meeting');
  expect(preview.textContent).toBe('/book/personal/existing-link');
});

it('expands optional settings in their original sections and restores focus on removal', async () => {
  const user = userEvent.setup();
  workspaceFixture('links');
  await user.click(
    screen.getByRole('button', { name: 'Try single-page editor' })
  );
  const dialog = within(
    screen.getByRole('dialog', { name: 'New personal booking link' })
  );
  for (const [detail, title] of [
    ['link', 'Custom link'],
    ['questions', 'Booking questions'],
    ['rules', 'Booking rules'],
  ] as const) {
    const section = dialog
      .getByRole('heading', { name: title })
      .closest<HTMLElement>(`[data-optional-setting="${detail}"]`);
    expect(section).toBeTruthy();
    if (!section) throw new Error(`Missing ${detail} section`);
    const add = within(section).getByRole('button', {
      name: `Add ${title.toLowerCase()}`,
    });
    expect(add.getAttribute('data-size')).toBe('md');
    expect(add.className).toContain('h-8');
    expect(add.className).not.toContain('h-10');
    expect(add.className).not.toContain('w-full');
    await user.click(add);
    expect(
      dialog.getByRole('heading', { name: title }).closest('section')
    ).toBe(section);
    expect(
      within(section).queryByRole('button', {
        name: `Add ${title.toLowerCase()}`,
      })
    ).toBeNull();
    if (detail === 'link')
      expect(
        within(section).getByRole('textbox', { name: 'Custom link' })
      ).toBeTruthy();
    if (detail === 'rules')
      expect(
        within(section).getByRole('heading', { name: 'Booking rules' })
      ).toBeTruthy();
    if (detail === 'questions') {
      const addQuestion = within(section).getByRole('button', {
        name: 'Add a question',
      });
      expect(addQuestion.getAttribute('data-size')).toBe('md');
      expect(addQuestion.className).toContain('h-8');
      const question = within(section).getByRole('textbox', {
        name: 'Question 1',
      });
      const marker = section.querySelector(
        `label[for="${question.id}"] span[aria-hidden="true"]`
      );
      expect(marker?.textContent).toBe('*');
      expect(marker?.className).toContain('text-failure');
    }
    await user.click(
      within(section).getByRole('button', {
        name: `Remove ${title.toLowerCase()}`,
      })
    );
    const restored = within(section).getByRole('button', {
      name: `Add ${title.toLowerCase()}`,
    });
    await waitFor(() => expect(document.activeElement).toBe(restored));
    expect(
      dialog.getByRole('heading', { name: title }).closest('section')
    ).toBe(section);
  }
});

it('saves single-page duration presets, meeting link choice, and booking questions', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links');
  await user.click(
    screen.getByRole('button', { name: 'Try single-page editor' })
  );
  const dialog = within(
    screen.getByRole('dialog', { name: 'New personal booking link' })
  );
  await user.click(dialog.getByRole('button', { name: /^Duration / }));
  await user.click(dialog.getByRole('option', { name: '45 minutes' }));
  expect(
    dialog.getByRole('button', { name: /^Duration / }).textContent
  ).toContain('45 minutes');
  expect(
    dialog.queryByRole('spinbutton', { name: 'Duration exact value' })
  ).toBeNull();
  await user.click(dialog.getByRole('button', { name: /^Meeting link type / }));
  expect(dialog.getByRole('option', { name: 'Google Meet' })).toBeTruthy();
  await user.click(dialog.getByRole('option', { name: 'Custom' }));
  await user.type(
    dialog.getByRole('textbox', { name: 'Location or meeting URL' }),
    'https://meet.example/test'
  );
  await user.click(
    dialog.getByRole('button', { name: 'Add booking questions' })
  );
  await user.type(
    dialog.getByRole('textbox', { name: 'Question 1' }),
    'What should we discuss?'
  );
  await user.click(dialog.getByRole('button', { name: 'Create link' }));
  expect(await dialog.findByText('Give this event a title.')).toBeTruthy();
  expect(saves).not.toHaveBeenCalled();
  await user.type(
    dialog.getByRole('textbox', { name: 'Title' }),
    'Coffee chat'
  );
  await user.click(dialog.getByRole('button', { name: 'Create link' }));
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(saves.mock.calls[0][1].eventTypes[0]).toMatchObject({
    title: 'Coffee chat',
    durationMinutes: 45,
    googleMeet: false,
    location: 'https://meet.example/test',
    questions: [{ label: 'What should we discuss?' }],
    enabled: true,
  });
});

it('preserves exact custom duration values when editing and saving a single-page link', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links', { durationMinutes: 37 });
  await user.click(
    screen.getByRole('button', { name: 'Options for Existing link' })
  );
  await user.click(
    screen.getByRole('menuitem', { name: 'Edit in single-page editor' })
  );
  const dialog = within(
    screen.getByRole('dialog', { name: 'Edit booking link' })
  );
  expect(
    dialog.getByRole('button', { name: /^Duration / }).textContent
  ).toContain('Custom duration');
  expect(
    dialog.getByRole('spinbutton', { name: 'Duration exact value' })
  ).toHaveProperty('value', '37');
  await user.click(dialog.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(saves.mock.calls[0][1].eventTypes[0].durationMinutes).toBe(37);
});

it('keeps a newly entered custom duration exact when saving', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links');
  await user.click(
    screen.getByRole('button', { name: 'Try single-page editor' })
  );
  const dialog = within(
    screen.getByRole('dialog', { name: 'New personal booking link' })
  );
  await user.click(dialog.getByRole('button', { name: /^Duration / }));
  await user.click(dialog.getByRole('option', { name: 'Custom duration' }));
  const exact = dialog.getByRole('spinbutton', {
    name: 'Duration exact value',
  });
  await user.clear(exact);
  await user.type(exact, '37');
  await user.type(
    dialog.getByRole('textbox', { name: 'Title' }),
    'Custom meeting'
  );
  await user.click(dialog.getByRole('button', { name: 'Create link' }));
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(saves.mock.calls[0][1].eventTypes[0].durationMinutes).toBe(37);
});

it('opens configured links in a distinct single-page edit dialog', async () => {
  const user = userEvent.setup();
  workspaceFixture('links', {
    questions: [{ id: 'q1', label: 'What should we cover?', required: true }],
    horizonDays: 30,
  });
  await user.click(
    screen.getByRole('button', { name: 'Options for Existing link' })
  );
  await user.click(
    screen.getByRole('menuitem', { name: 'Edit in single-page editor' })
  );

  const dialog = within(
    screen.getByRole('dialog', { name: 'Edit booking link' })
  );
  expect(dialog.getByRole('textbox', { name: 'Title' })).toHaveProperty(
    'value',
    'Existing link'
  );
  expect(dialog.getByRole('textbox', { name: 'Question 1' })).toHaveProperty(
    'value',
    'What should we cover?'
  );
  expect(dialog.getByRole('heading', { name: 'Booking rules' })).toBeTruthy();
  expect(dialog.queryByText('Name and email are always collected.')).toBeNull();
  expect(
    dialog.queryByText(
      'Control notice, booking range, buffers, and daily limits.'
    )
  ).toBeNull();
  expect(dialog.queryByRole('button', { name: 'Next' })).toBeNull();
});

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

it('shows a two-handle booking range and an exact interval beside its marked slider', async () => {
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
  expect(
    within(range).getByRole('heading', { name: 'Booking range' })
  ).toBeTruthy();
  expect(range.getAttribute('aria-describedby')).toBeNull();
  expect(range.querySelector('[data-booking-slider-scale]')?.textContent).toBe(
    'Immediately30 days+'
  );
  expect(screen.queryByText(/Measured from now/)).toBeNull();
  expect(range.classList.contains('gap-1.5')).toBe(true);
  expect(range.classList.contains('gap-3')).toBe(false);
  const row = range.querySelector('[data-booking-range-row]')!;
  const earliestControl = row.querySelector('[data-booking-range-earliest]')!;
  const timeline = row.querySelector('[data-booking-range-timeline]')!;
  const latestControl = row.querySelector('[data-booking-range-latest]')!;
  expect(row.classList.contains('grid-cols-2')).toBe(true);
  expect(row.classList.contains('sm:grid-cols-[auto_minmax(0,1fr)_auto]')).toBe(
    true
  );
  expect(earliestControl.classList.contains('sm:order-1')).toBe(true);
  expect(timeline.classList.contains('sm:order-2')).toBe(true);
  expect(latestControl.classList.contains('order-3')).toBe(true);
  expect(earliestControl.contains(bookingRuleInput('From'))).toBe(true);
  expect(latestControl.contains(bookingRuleInput('To'))).toBe(true);
  expect(timeline.contains(bookingThumb('From'))).toBe(true);
  expect(timeline.contains(bookingThumb('To'))).toBe(true);
  for (const label of [
    "What's the earliest someone can book?",
    "What's the latest someone can book?",
  ]) {
    expect(within(range).queryByText(label)).toBeNull();
  }
  expect(
    bookingRuleInput('To').parentElement?.closest('.items-end')
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
    expect(input.getAttribute('aria-label')).toBe(`${label} exact value`);
    const frame = input.closest('[data-number-unit-input]');
    expect(frame?.getAttribute('data-variant')).not.toBe('bare');
    expect(frame?.contains(units)).toBe(true);
    const thumb = bookingThumb(label);
    expect(range.contains(thumb)).toBe(true);
    expect(thumb.getAttribute('aria-valuemin')).toBe(
      label.includes('earliest') ? '0' : '1'
    );
  }
  expect(
    bookingThumb("What's the earliest someone can book?").getAttribute(
      'aria-valuenow'
    )
  ).toBe('120');
  expect(
    bookingThumb("What's the latest someone can book?").getAttribute(
      'aria-valuenow'
    )
  ).toBe('30');
  expect((bookingRuleInput('From') as HTMLInputElement).value).toBe('2');
  expect((bookingRuleInput('To') as HTMLInputElement).value).toBe('60');
  const interval = bookingRuleInput('Time-slot interval') as HTMLInputElement;
  expect(interval.value).toBe('17');
  expect(bookingThumb('Time-slot interval').getAttribute('aria-valuenow')).toBe(
    '17'
  );
  expect(interval.getAttribute('aria-valuemax')).toBe('480');
  fireEvent.input(interval, { target: { value: '480' } });
  fireEvent.blur(interval);
  expect(draft().intervalMinutes).toBe(480);
  expect(bookingThumb('Time-slot interval').getAttribute('aria-valuenow')).toBe(
    '60'
  );
  fireEvent.keyDown(bookingThumb('Time-slot interval'), { key: 'Home' });
  expect(draft().intervalMinutes).toBe(5);
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

it('uses labeled minute inputs for meeting spacing alongside booking sliders', async () => {
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
  expect(bookingThumb('Time-slot interval')).toBeTruthy();
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
  // External edits return to Auto when whole weeks cannot represent the amount.
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
  const thumb = bookingThumb('Duration');

  for (let minutes = 5; minutes < 15; minutes++) {
    setDuration(minutes);
    expect(input.value).toBe(String(minutes));
    expect(thumb.getAttribute('aria-valuenow')).toBe(String(minutes));
    expect(thumb.getAttribute('aria-valuetext')).toBe(`${minutes} minutes`);
    expect(thumb.getAttribute('aria-valuemin')).toBe('5');
    expect(duration()).toBe(minutes);
  }
  expect(changes).not.toHaveBeenCalled();
  setDuration(5);
  thumb.focus();
  fireEvent.keyDown(thumb, { key: 'Home' });
  fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
  expect(duration()).toBe(5);
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  expect(duration()).toBe(15);
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  expect(duration()).toBe(30);
  fireEvent.keyDown(thumb, { key: 'Home' });
  expect(duration()).toBe(5);
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
  const thumb = bookingThumb('Duration');
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

it('moves duration with pointer gestures and updates its accessible current value', async () => {
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
  const thumb = bookingThumb('Duration');
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
  // Shared Tooltip omits popup markup in test mode; real-browser checks verify its anchor.
  expect(thumb.getAttribute('aria-valuetext')).toBe('45 minutes');
  expect(track.querySelector('[role="tooltip"]')).toBeNull();
  fireEvent.pointerMove(thumb, { clientX: 46, ctrlKey: true });
  expect(value()).toBe(46);
  fireEvent.pointerMove(thumb, { clientX: 47, ctrlKey: true });
  expect(value()).toBe(47);
  fireEvent.pointerMove(thumb, { clientX: 60 });
  expect(value()).toBe(60);
  expect(thumb.getAttribute('aria-valuetext')).toBe('1 hour');
  fireEvent.pointerUp(thumb, { clientX: 60 });
});

it.each([
  { label: 'Duration', exact: 30, displayMax: 480, step: 15 },
  { label: 'Duration', exact: 37, displayMax: 480, step: 15 },
  { label: 'Time-slot interval', exact: 480, displayMax: 60, step: 5 },
])(
  'preserves $label exact value $exact when its thumb is pressed without movement',
  async ({ label, exact, displayMax, step }) => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    const [value, setValue] = createSignal(exact);
    const changes = vi.fn((next: number) => setValue(next));
    render(() => (
      <BookingValueSlider
        label={label}
        value={value()}
        min={5}
        max={480}
        sliderMax={displayMax}
        sliderStep={step}
        unit="min"
        disabled={false}
        onChange={changes}
      />
    ));
    const thumb = bookingThumb(label);
    mockSliderPointer(thumb, displayMax);
    const x = Math.min(exact, displayMax);
    fireEvent.pointerDown(thumb, { clientX: x, button: 0 });
    expect(value()).toBe(exact);
    fireEvent.pointerMove(thumb, { clientX: x });
    fireEvent.pointerUp(thumb, { clientX: x });
    await Promise.resolve();
    expect(value()).toBe(exact);
    expect(changes).not.toHaveBeenCalled();
  }
);

it('reaches the advertised duration maximum with a pointer drag', () => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  const [value, setValue] = createSignal(30);
  render(() => (
    <BookingValueSlider
      label="Duration"
      value={value()}
      min={5}
      max={480}
      sliderStep={15}
      unit="min"
      disabled={false}
      onChange={setValue}
    />
  ));
  const thumb = bookingThumb('Duration');
  mockSliderPointer(thumb, 480);
  fireEvent.pointerDown(thumb, { clientX: 30, button: 0 });
  fireEvent.pointerMove(thumb, { clientX: 480 });
  fireEvent.pointerUp(thumb, { clientX: 480 });
  expect(value()).toBe(480);
});

it.each(['Earliest booking time', 'Latest booking time'])(
  'preserves both exact range endpoints when %s is pressed without movement',
  async (label) => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    const draft = timelineRulesFixture({ noticeMinutes: 120, horizonDays: 60 });
    const thumb = bookingThumb(
      label === 'Earliest booking time' ? 'From' : 'To'
    );
    mockSliderPointer(thumb, 100);
    const x =
      label === 'Earliest booking time'
        ? bookingTimelinePosition(120, BOOKING_RANGE_TIMELINE)
        : 100;
    fireEvent.pointerDown(thumb, { clientX: x, button: 0 });
    expect(draft().noticeMinutes).toBe(120);
    expect(draft().horizonDays).toBe(60);
    fireEvent.pointerMove(thumb, { clientX: x });
    fireEvent.pointerUp(thumb, { clientX: x });
    await Promise.resolve();
    expect(draft().noticeMinutes).toBe(120);
    expect(draft().horizonDays).toBe(60);
  }
);

it('moves the interval slider with pointer and keyboard without changing exact overflow bounds', () => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  const draft = timelineRulesFixture({ intervalMinutes: 480 });
  const thumb = bookingThumb('Time-slot interval');
  const input = bookingRuleInput('Time-slot interval') as HTMLInputElement;
  expect(input.value).toBe('480');
  expect(thumb.getAttribute('aria-valuenow')).toBe('60');
  expect(thumb.getAttribute('aria-valuetext')).toContain(
    'exact value 480 minutes'
  );
  expect(input.getAttribute('aria-valuemax')).toBe('480');
  const track = thumb.parentElement!;
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 110, 8)
  );
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
  fireEvent.pointerDown(thumb, { clientX: 110, button: 0 });
  fireEvent.pointerMove(thumb, { clientX: 0 });
  expect(draft().intervalMinutes).toBe(5);
  fireEvent.pointerUp(thumb, { clientX: 0 });
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  expect(draft().intervalMinutes).toBe(10);
  fireEvent.keyDown(thumb, { key: 'End' });
  expect(draft().intervalMinutes).toBe(60);
  fireEvent.input(input, { target: { value: '480' } });
  fireEvent.blur(input);
  expect(draft().intervalMinutes).toBe(480);
});

it('keeps range units independent and shows frequency sliders with right-hand exact inputs', async () => {
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
  expect(
    screen.getByRole('region', { name: 'Meeting times guests can choose' })
  ).toBeTruthy();
  expect(
    screen.getByRole('region', { name: 'Time between meetings' })
  ).toBeTruthy();
  expect((bookingRuleInput('Meeting buffers') as HTMLInputElement).value).toBe(
    '0'
  );
  for (const label of [
    "What's the earliest someone can book?",
    "What's the latest someone can book?",
    'Time-slot interval',
    'Daily booking limit',
  ]) {
    expect(bookingThumb(label)).toBeTruthy();
    const input = bookingRuleInput(label);
    expect(input).toBeTruthy();
    const slider = bookingThumb(label);
    const expectedPosition =
      label === "What's the earliest someone can book?"
        ? Node.DOCUMENT_POSITION_PRECEDING
        : Node.DOCUMENT_POSITION_FOLLOWING;
    expect(
      slider.compareDocumentPosition(input) & expectedPosition
    ).toBeTruthy();
  }
  for (const [label, minimum, maximum] of [
    ['Time-slot interval', '5 min', '60 min+'],
    ['Daily booking limit', 'Infinite', '100'],
  ]) {
    const group = screen.getByRole('group', { name: label });
    const scale = group.querySelector('[data-booking-slider-scale]')!;
    expect(scale.children[0]?.textContent).toBe(minimum);
    expect(scale.children[1]?.textContent).toBe(maximum);
    expect(
      scale.compareDocumentPosition(bookingThumb(label)) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  }
  const intervalGroup = screen.getByRole('group', {
    name: 'Time-slot interval',
  });
  const marks = intervalGroup.querySelector('[data-booking-slider-marks]')!;
  expect(marks.children).toHaveLength(10);
  const tickPositions = Array.from(marks.children, (mark) =>
    (mark as HTMLElement).style.getPropertyValue('inset-inline-start')
  );
  expect(tickPositions).toEqual(
    Array.from(
      { length: 10 },
      (_, index) => `${(((index + 2) * 5 - 5) / 55) * 100}%`
    )
  );
  expect(tickPositions).not.toContain('0%');
  expect(tickPositions).not.toContain('100%');
  for (const mark of Array.from(marks.children)) {
    expect(mark.classList.contains('h-3')).toBe(true);
    expect(mark.classList.contains('w-0.5')).toBe(true);
    expect(mark.classList.contains('bg-ink-muted/70')).toBe(true);
  }
  expect(
    intervalGroup.querySelector('[data-booking-slider-mark-labels]')
      ?.textContent
  ).toBe('153045');
  expect(bookingThumb('Time-slot interval').getAttribute('aria-valuemin')).toBe(
    '5'
  );
  expect(bookingThumb('Time-slot interval').getAttribute('aria-valuemax')).toBe(
    '60'
  );
  expect(
    bookingThumb('Daily booking limit').getAttribute('aria-valuemin')
  ).toBe('0');
  expect(
    bookingThumb('Daily booking limit').getAttribute('aria-valuemax')
  ).toBe('100');
  const input = bookingRuleInput('From');
  await user.click(input);
  fireEvent.input(input, { target: { value: '2' } });
  fireEvent.blur(input);
  expect(draft().noticeMinutes).toBe(120);
  await user.click(
    screen.getByRole('combobox', {
      name: "What's the earliest someone can book? units",
    })
  );
  await user.click(screen.getByRole('option', { name: 'Days' }));
  fireEvent.input(input, { target: { value: '1' } });
  fireEvent.blur(input);
  expect(draft().noticeMinutes).toBe(1440);
  expect(draft().horizonDays).toBe(60);
  expect(bookingRuleInput('From')).toBe(input);
});

it('keeps duration slider and exact input visible at preset values', () => {
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
  const thumb = bookingThumb('Duration');
  const input = bookingRuleInput('Duration') as HTMLInputElement;
  expect(input.value).toBe('30');
  const scale = thumb
    .closest('[role="group"]')!
    .querySelector('[data-booking-slider-scale]')!;
  expect(scale?.children[0]?.textContent).toBe('5 minutes');
  expect(scale?.children[1]?.textContent).toBe('8 hours');
  expect(
    scale?.compareDocumentPosition(thumb) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(thumb.getAttribute('aria-valuenow')).toBe('30');
  expect(
    thumb.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  fireEvent.input(input, { target: { value: '45' } });
  fireEvent.blur(input);
  expect(value()).toBe(45);
  expect(thumb.getAttribute('aria-valuenow')).toBe('45');
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  expect(value()).toBe(60);
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
      .querySelector('[data-booking-range-row]')
  ).not.toBeNull();
  const frequency = screen.getByRole('region', { name: 'Booking frequency' });
  expect(
    within(frequency).getByRole('group', { name: 'Daily booking limit' })
  ).toBeTruthy();
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
  expect(bookingThumb('Time-slot interval')).toBeTruthy();
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
    expect(choice.classList.contains('bg-accent/10')).toBe(selected);
    expect(choice.classList.contains('border-accent/30')).toBe(selected);
    expect(choice.classList.contains('bg-accent')).toBe(false);
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

it('maps daily zero to no limit through exact input and slider edits', async () => {
  const user = userEvent.setup();
  const { saves } = workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  await advanceEditor(user, 3);
  const input = bookingRuleInput('Daily booking limit') as HTMLInputElement;
  const thumb = bookingThumb('Daily booking limit');
  expect(input.value).toBe('0');
  expect(thumb.getAttribute('aria-valuenow')).toBe('0');
  const group = screen.getByRole('group', { name: 'Daily booking limit' });
  const zeroLabel = () => group.querySelector('[data-booking-zero-label]');
  expect(zeroLabel()?.textContent).toBe('Infinite');
  expect(input.getAttribute('aria-valuetext')).toBe('Infinite');
  expect(input.classList.contains('text-transparent')).toBe(true);
  await user.click(input);
  expect(input.value).toBe('0');
  expect(zeroLabel()).toBeNull();
  expect(input.classList.contains('text-transparent')).toBe(false);
  fireEvent.input(input, { target: { value: '12' } });
  fireEvent.blur(input);
  expect(input.value).toBe('12');
  expect(zeroLabel()).toBeNull();
  expect(input.getAttribute('aria-valuetext')).not.toBe('Infinite');
  fireEvent.input(input, { target: { value: '0' } });
  fireEvent.blur(input);
  expect(input.value).toBe('0');
  expect(zeroLabel()?.textContent).toBe('Infinite');
  await user.click(screen.getByRole('button', { name: 'Back' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(bookingRuleInput('Daily booking limit')).toBe(input);
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  expect(input.value).toBe('1');
  fireEvent.input(input, { target: { value: '19' } });
  fireEvent.blur(input);
  fireEvent.input(input, { target: { value: '0' } });
  fireEvent.blur(input);
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  expect(input.value).toBe('1');
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

it('remembers positive daily limits when the rule becomes unlimited', () => {
  const [editor, dispose] = createRoot(
    (dispose) =>
      [
        createEventEditor({
          event: newEventType('hours', ['user'], false),
          events: () => [],
          missingHosts: () => [],
          hasSchedule: () => true,
          createActive: () => false,
          onSave: async () => {},
        }),
        dispose,
      ] as const
  );
  try {
    editor.update('dailyLimit', 12);
    editor.setDailyLimitEnabled(false);
    expect(editor.draft().dailyLimit).toBeNull();
    editor.setDailyLimitEnabled(true);
    expect(editor.draft().dailyLimit).toBe(12);
    editor.update('dailyLimit', 19);
    editor.setDailyLimitEnabled(false);
    editor.setDailyLimitEnabled(true);
    expect(editor.draft().dailyLimit).toBe(19);
  } finally {
    dispose();
  }
});

it('focuses an invalid saved zero daily limit and clears validation on editing', async () => {
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
  const input = bookingRuleInput('Daily booking limit');
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(editor.getByRole('alert').textContent).toContain('1–100');
  await waitFor(() => expect(document.activeElement).toBe(input));
  fireEvent.input(input, { target: { value: '5' } });
  fireEvent.blur(input);
  expect(editor.queryByRole('alert')).toBeNull();
  fireEvent.input(input, { target: { value: '0' } });
  fireEvent.blur(input);
  await user.click(editor.getByRole('button', { name: 'Next' }));
  await user.click(editor.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(saves).toHaveBeenCalledOnce());
  expect(saves.mock.calls[0][1].eventTypes[0].dailyLimit).toBeNull();
});

it('keeps duration and interval exact inputs available without activating custom modes', async () => {
  const user = userEvent.setup();
  workspaceFixture('links');
  await user.click(screen.getByRole('button', { name: 'New booking link' }));
  const duration = bookingRuleInput('Duration') as HTMLInputElement;
  await user.click(duration);
  await user.clear(duration);
  await user.type(duration, '17');
  expect(duration.value).toBe('17');
  await advanceEditor(user, 3);
  for (const label of ['From', 'To']) {
    await focusBookingRule(user, label);
    expect(document.activeElement).toBe(bookingRuleInput(label));
  }
  const interval = bookingRuleInput('Time-slot interval') as HTMLInputElement;
  await user.click(interval);
  await user.clear(interval);
  await user.type(interval, '480');
  expect(interval.value).toBe('480');
  fireEvent.blur(interval);
  expect(bookingThumb('Time-slot interval')).toBeTruthy();
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
  expect(header.children).toHaveLength(2);
  expect(header.firstElementChild?.tagName.toLowerCase()).toBe('h3');
  expect(header.classList.contains('justify-between')).toBe(true);
  expect(header.classList.contains('items-center')).toBe(true);
  expect(header.classList.contains('border-b')).toBe(false);
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
    form.getByRole('heading', { name: 'Meeting details' }).closest('header')
  ).toBe(header);
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
  expect(reviewHeading.classList.contains('text-xl')).toBe(true);
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
  expect(questionHeading.closest('header')).not.toBeNull();
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

it.each([
  {
    noticeMinutes: 10080,
    horizonDays: 365,
    moved: "What's the earliest someone can book?",
    retained: 'horizonDays' as const,
    value: 365,
  },
  {
    noticeMinutes: 10080,
    horizonDays: 365,
    moved: "What's the latest someone can book?",
    retained: 'noticeMinutes' as const,
    value: 10080,
  },
])(
  'preserves exact overflow $retained when the other booking-range handle moves',
  ({ noticeMinutes, horizonDays, moved, retained, value }) => {
    const [draft, setDraft] = createSignal({
      ...newEventType('hours', ['user'], false),
      noticeMinutes,
      horizonDays,
    });
    render(() => (
      <BookingRuleSliders
        draft={draft()}
        disabled={false}
        onUpdate={(key, next) =>
          setDraft((current) => ({ ...current, [key]: next }))
        }
        onBuffers={() => {}}
        onDailyLimitEnabled={() => {}}
      />
    ));
    expect((bookingRuleInput('To') as HTMLInputElement).value).toBe('365');
    expect((bookingRuleInput('From') as HTMLInputElement).value).toBe('7');
    fireEvent.keyDown(bookingThumb(moved), { key: 'Home' });
    expect(draft()[retained]).toBe(value);
    expect(
      (
        bookingRuleInput(
          retained === 'horizonDays' ? 'To' : 'From'
        ) as HTMLInputElement
      ).value
    ).toBe(retained === 'horizonDays' ? '365' : '7');
  }
);

it('disables every visible rule input and slider', async () => {
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
    const input = bookingRuleInput(label);
    expect(input.hasAttribute('disabled')).toBe(true);
    await user.click(input);
  }
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(
    screen
      .getAllByRole('spinbutton')
      .every((input) => input.hasAttribute('disabled'))
  ).toBe(true);
  for (const label of [
    "What's the earliest someone can book?",
    "What's the latest someone can book?",
    'Time-slot interval',
    'Daily booking limit',
  ]) {
    const thumb = bookingThumb(label);
    expect(thumb.getAttribute('data-disabled')).not.toBeNull();
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  }
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

it('edits booking limits and buffers through exact inputs alongside sliders', () => {
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
  expect(bookingThumb('Time-slot interval')).toBeTruthy();
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

it('shows exact values for long meeting breaks alongside booking sliders', () => {
  const draft = timelineRulesFixture({
    beforeMinutes: 6000,
    afterMinutes: 7000,
  });
  expect(bookingThumb('Time-slot interval')).toBeTruthy();
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
