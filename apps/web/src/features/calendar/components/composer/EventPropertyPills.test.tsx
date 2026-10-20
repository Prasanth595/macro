/**
 * @vitest-environment jsdom
 */

import { recipientEntityMapper } from '@core/user';
import { cleanup, render, screen, within } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Dialog } from '@ui';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventDateTimeRangeFields } from './EventDateTimeRangeFields';
import {
  EventComposerConferencePill,
  EventComposerGuestsPill,
  EventComposerKindPill,
} from './EventPropertyPills';
import type {
  EventEditorConferenceChoice,
  EventEditorGuestOption,
  SelectedEventEditorGuest,
} from './event-form-model';

vi.mock('@core/component/UserIcon', () => ({
  UserIcon: () => {
    const el = document.createElement('div');
    el.setAttribute('data-testid', 'user-avatar');
    return el;
  },
}));

vi.mock('@property/editors/selectors/PropertyEntitySelector', () => ({
  PropertyEntitySelector: () => {
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Search for guests');
    input.setAttribute('placeholder', 'Add guests...');
    return input;
  },
}));

function guest(email: string, name: string): EventEditorGuestOption {
  return recipientEntityMapper('user')({
    id: `macro|${email}`,
    email,
    name,
  });
}

function renderInComposerDialog() {
  const [selected, setSelected] = createSignal<SelectedEventEditorGuest[]>([]);

  render(() => (
    <Dialog open>
      <input aria-label="Title" />
      <EventComposerGuestsPill
        options={() => [guest('ada@example.com', 'Ada Lovelace')]}
        selected={selected()}
        onChange={setSelected}
      />
    </Dialog>
  ));
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class WebSocketStub {
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.stubGlobal('IntersectionObserver', ResizeObserverStub);
  vi.stubGlobal('WebSocket', WebSocketStub);
  vi.stubGlobal('scrollTo', vi.fn() as unknown as typeof window.scrollTo);
});

describe('composer popovers inside a dialog', () => {
  it('selects a nested time without dismissing the date picker or composer', async () => {
    const user = userEvent.setup();
    render(() => {
      const [start, setStart] = createSignal('2026-10-06T09:00');
      return (
        <Dialog open>
          <input aria-label="Title" />
          <EventDateTimeRangeFields
            start={start()}
            end="2026-10-06T10:00"
            allDay={false}
            onRangeChange={setStart}
            onAllDayChange={vi.fn()}
          />
        </Dialog>
      );
    });
    screen.getByLabelText('Title').focus();
    const trigger = screen.getByRole('button', {
      name: 'Edit event date and time range',
    });
    await user.click(trigger);
    const time = screen.getByLabelText('Start time');
    await user.click(time);
    await user.click(screen.getByRole('option', { name: '9:30 AM' }));
    expect((time as HTMLInputElement).value).toBe('09:30');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByLabelText('Title')).toBeTruthy();
  });
  it('keeps locked dates as text while the editable end remains interactive', async () => {
    const user = userEvent.setup();
    const onRangeChange = vi.fn();
    render(() => (
      <EventDateTimeRangeFields
        start="2026-10-06T09:00"
        end="2026-10-06T10:00"
        allDay={false}
        startReadOnly
        allDayReadOnly
        onRangeChange={onRangeChange}
        onAllDayChange={vi.fn()}
      />
    ));
    await user.click(
      screen.getByRole('button', { name: 'Edit event date and time range' })
    );
    expect(screen.getByLabelText('Start date and time').textContent).toContain(
      '9:00 AM'
    );
    expect(screen.queryByLabelText('Start time')).toBeNull();
    expect(screen.queryByRole('switch', { name: 'All day' })).toBeNull();
    await user.click(
      within(screen.getAllByRole('grid')[0]).getByRole('gridcell', {
        name: '9',
      })
    );
    expect(onRangeChange).toHaveBeenLastCalledWith(
      '2026-10-06T09:00',
      '2026-10-09T10:00'
    );
    await user.click(screen.getByLabelText('End time'));
    await user.click(screen.getByRole('option', { name: /10:30 AM/ }));
    expect(onRangeChange).toHaveBeenLastCalledWith(
      '2026-10-06T09:00',
      '2026-10-06T10:30'
    );
  });

  it('selects one connected range across months without publishing a partial range', async () => {
    const user = userEvent.setup();
    const onRangeChange = vi.fn();
    render(() => (
      <EventDateTimeRangeFields
        start="2026-10-06T09:00"
        end="2026-10-06T10:00"
        allDay={false}
        onRangeChange={onRangeChange}
        onAllDayChange={vi.fn()}
      />
    ));
    const trigger = screen.getByRole('button', {
      name: 'Edit event date and time range',
    });
    await user.click(trigger);
    const grids = screen.getAllByRole('grid');
    expect(grids).toHaveLength(2);
    await user.click(within(grids[0]).getByRole('gridcell', { name: '20' }));
    expect(onRangeChange).not.toHaveBeenCalled();
    await user.click(within(grids[1]).getByRole('gridcell', { name: '12' }));
    expect(onRangeChange).toHaveBeenCalledExactlyOnceWith(
      '2026-10-20T09:00',
      '2026-11-12T10:00'
    );
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps a fully locked range as plain content', () => {
    render(() => (
      <EventDateTimeRangeFields
        start="2026-10-06"
        end="2026-10-09"
        allDay
        startReadOnly
        endReadOnly
        allDayReadOnly
        onRangeChange={vi.fn()}
        onAllDayChange={vi.fn()}
      />
    ));
    expect(screen.queryByRole('button')).toBeNull();
    expect(
      screen.getByLabelText('Event date and time range').textContent
    ).toContain('All day');
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('EventComposerGuestsPill', () => {
  it('opens the guest list on the first click from the title field', async () => {
    const user = userEvent.setup();
    renderInComposerDialog();

    screen.getByLabelText('Title').focus();
    const guests = screen.getByRole('button', { name: 'Guests' });
    await user.click(guests);

    // The property dropdown is modal, so the composer dialog (and this
    // trigger) is aria-hidden while the list is open.
    expect(guests.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByPlaceholderText('Add guests...')).toBeTruthy();
  });
  it('closes the selector when guests become read-only and displays their values directly', async () => {
    const user = userEvent.setup();
    const [readOnly, setReadOnly] = createSignal(false);
    const onChange = vi.fn();
    render(() => (
      <EventComposerGuestsPill
        options={() => [guest('ada@example.com', 'Ada Lovelace')]}
        selected={[guest('ada@example.com', 'Ada Lovelace')]}
        readOnly={readOnly()}
        onChange={onChange}
      />
    ));
    await user.click(screen.getByRole('button', { name: 'Guests' }));
    expect(screen.getByPlaceholderText('Add guests...')).toBeTruthy();
    setReadOnly(true);
    expect(screen.queryByRole('button', { name: 'Guests' })).toBeNull();
    expect(screen.queryByPlaceholderText('Add guests...')).toBeNull();
    await user.click(screen.getByText('Ada Lovelace'));
    expect(screen.getByText('ada@example.com')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('EventComposerKindPill', () => {
  it('selects a type and blocks changes while saving', async () => {
    const user = userEvent.setup();
    const [eventType, setEventType] = createSignal<'default' | 'out_of_office'>(
      'default'
    );
    const [pending, setPending] = createSignal(false);
    render(() => (
      <EventComposerKindPill
        eventType={eventType()}
        onChange={setEventType}
        disabled={pending()}
      />
    ));
    const event = screen.getByRole('radio', { name: /^Event$/ });
    const away = screen.getByRole('radio', {
      name: /^Out of office$/,
    });
    expect(event).toHaveProperty('checked', true);
    await user.click(screen.getByText('Out of office', { exact: true }));
    expect(eventType()).toBe('out_of_office');
    expect(away).toHaveProperty('checked', true);
    setPending(true);
    await user.click(screen.getByText('Event', { exact: true }));
    expect(eventType()).toBe('out_of_office');
    expect(event.hasAttribute('disabled')).toBe(true);
    expect(away.hasAttribute('disabled')).toBe(true);
  });

  it('shows an immutable provider type as plain content instead of editable pills', () => {
    const onChange = vi.fn();
    render(() => (
      <EventComposerKindPill
        eventType="focus_time"
        readOnly
        onChange={onChange}
      />
    ));
    expect(screen.getByLabelText('Event type').textContent).toContain(
      'Focus time'
    );
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
describe('EventComposerConferencePill', () => {
  it('offers Macro only after the host flag resolves enabled', async () => {
    const user = userEvent.setup();
    const [enabled, setEnabled] = createSignal(false);
    render(() => (
      <EventComposerConferencePill
        value="none"
        macroCallsEnabled={enabled()}
        canKeepExisting={false}
        onChange={vi.fn()}
      />
    ));
    await user.click(
      screen.getByRole('button', { name: /Video conferencing/ })
    );
    expect(screen.queryByRole('option', { name: 'Macro call' })).toBeNull();
    setEnabled(true);
    expect(
      await screen.findByRole('option', { name: 'Macro call' })
    ).toBeTruthy();
    setEnabled(false);
    expect(screen.queryByRole('option', { name: 'Macro call' })).toBeNull();
  });

  it('shows the Macro selection and lets users switch to no link or Google Meet inside the composer dialog', async () => {
    const user = userEvent.setup();
    render(() => {
      const [choice, setChoice] =
        createSignal<EventEditorConferenceChoice>('macro');
      return (
        <Dialog open>
          <input aria-label="Title" />
          <EventComposerConferencePill
            value={choice()}
            macroCallsEnabled
            canKeepExisting={false}
            onChange={setChoice}
          />
        </Dialog>
      );
    });
    const trigger = screen.getByRole('button', {
      name: /Video conferencing/,
    });
    expect(trigger.textContent).toContain('Macro call');
    screen.getByLabelText('Title').focus();
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'No meeting link' }));
    expect(trigger.textContent).toContain('Add meeting link');
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'Google Meet' }));
    expect(trigger.textContent).toContain('Google Meet');
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'Macro call' }));
    expect(trigger.textContent).toContain('Macro call');
  });

  it('does not offer a new Macro call when calls are unavailable', async () => {
    const user = userEvent.setup();
    render(() => (
      <EventComposerConferencePill
        value="none"
        macroCallsEnabled={false}
        canKeepExisting={false}
        onChange={vi.fn()}
      />
    ));
    await user.click(
      screen.getByRole('button', { name: /Video conferencing/ })
    );
    expect(screen.queryByRole('option', { name: 'Macro call' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Google Meet' })).toBeTruthy();
  });
});
