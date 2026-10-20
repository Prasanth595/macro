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
          <div data-testid="composer-sidebar" class="portal-scope">
            <input aria-label="Title" />
            <EventDateTimeRangeFields
              start={start()}
              end="2026-10-06T10:00"
              allDay={false}
              onRangeChange={setStart}
              onAllDayChange={vi.fn()}
            />
          </div>
        </Dialog>
      );
    });
    screen.getByLabelText('Title').focus();
    const trigger = screen.getByRole('button', {
      name: 'Edit event date and time range',
    });
    await user.click(trigger);
    expect(
      screen
        .getByTestId('composer-sidebar')
        .contains(screen.getByRole('dialog', { name: 'Event date and time' }))
    ).toBe(false);
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
    expect(screen.getAllByRole('grid')).toHaveLength(1);
    await user.click(
      within(screen.getByRole('grid')).getByRole('gridcell', { name: '20' })
    );
    expect(onRangeChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Go to next month' }));
    await user.click(
      within(screen.getByRole('grid')).getByRole('gridcell', { name: '12' })
    );
    expect(onRangeChange).toHaveBeenCalledExactlyOnceWith(
      '2026-10-20T09:00',
      '2026-11-12T10:00'
    );
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('expands for multiple days and returns to one calendar for a same-day range', async () => {
    const user = userEvent.setup();
    render(() => {
      const [range, setRange] = createSignal({
        start: '2026-10-06T09:00',
        end: '2026-10-06T10:00',
      });
      return (
        <EventDateTimeRangeFields
          start={range().start}
          end={range().end}
          allDay={false}
          onRangeChange={(start, end) => setRange({ start, end })}
          onAllDayChange={vi.fn()}
        />
      );
    });
    await user.click(
      screen.getByRole('button', { name: 'Edit event date and time range' })
    );
    expect(screen.getAllByRole('grid')).toHaveLength(1);
    expect(
      screen.queryByText('Choose a start day, then an end day.')
    ).toBeNull();
    await user.click(
      within(screen.getByRole('grid')).getByRole('gridcell', { name: '20' })
    );
    await user.click(screen.getByRole('button', { name: 'Go to next month' }));
    await user.click(
      within(screen.getByRole('grid')).getByRole('gridcell', { name: '22' })
    );
    expect(screen.getAllByRole('grid')).toHaveLength(2);
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(screen.getByText('November 2026')).toBeTruthy();
    const firstMonth = within(screen.getAllByRole('grid')[0]);
    await user.click(firstMonth.getByRole('gridcell', { name: '21' }));
    await user.click(firstMonth.getByRole('gridcell', { name: '21' }));
    expect(screen.getAllByRole('grid')).toHaveLength(1);
    expect(screen.getByLabelText('Start time')).toHaveProperty(
      'value',
      '09:00'
    );
    expect(screen.getByLabelText('End time')).toHaveProperty('value', '10:00');
  });

  it('shows adjacent-month dates without publishing them as a range', async () => {
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
    await user.click(
      screen.getByRole('button', { name: 'Edit event date and time range' })
    );
    const calendar = screen.getByRole('grid');
    const outsideDays = calendar.querySelectorAll('button[data-outside-month]');
    expect(outsideDays.length).toBeGreaterThan(0);
    for (const day of outsideDays) expect(day).toHaveProperty('disabled', true);
    await user.click(
      within(calendar).getAllByRole('gridcell', { name: '30' })[0]
    );
    expect(onRangeChange).not.toHaveBeenCalled();
  });

  it('jumps months and years from either connected panel without changing the selected range', async () => {
    const user = userEvent.setup();
    const onRangeChange = vi.fn();
    render(() => (
      <EventDateTimeRangeFields
        start="2026-10-30T09:00"
        end="2026-11-02T10:00"
        allDay={false}
        onRangeChange={onRangeChange}
        onAllDayChange={vi.fn()}
      />
    ));
    await user.click(
      screen.getByRole('button', { name: 'Edit event date and time range' })
    );
    const secondMonth = screen.getByRole('button', {
      name: 'Choose month and year, currently November 2026',
    });
    await user.click(secondMonth);
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'November 2026'
    );
    await user.click(
      screen.getByRole('button', { name: 'Choose year, currently 2026' })
    );
    await user.click(screen.getByRole('button', { name: 'Next years' }));
    await user.click(screen.getByRole('button', { name: '2032' }));
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'November 2032'
    );
    await user.keyboard('{ArrowRight}{Enter}');
    expect(
      screen.getByRole('button', {
        name: 'Choose month and year, currently November 2032',
      })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Choose month and year, currently December 2032',
      })
    ).toBeTruthy();
    expect(onRangeChange).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', {
        name: 'Choose month and year, currently November 2032',
      })
    );
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'November 2032'
    );
    await user.keyboard('{Escape}');
    expect(
      screen
        .getByRole('button', {
          name: 'Choose month and year, currently November 2032',
        })
        .getAttribute('aria-expanded')
    ).toBe('false');
    expect(
      screen.getByRole('dialog', { name: 'Event date and time' })
    ).toBeTruthy();
    expect(onRangeChange).not.toHaveBeenCalled();
  });

  it.each([
    {
      start: '1000-10-01T09:00',
      end: '1000-11-02T10:00',
      heading: 'November 1000',
      month: 'January 1000',
      expected: ['January 1000', 'February 1000'],
      selectedStart: '1000-01-20T09:00',
      selectedEnd: '1000-01-21T10:00',
    },
    {
      start: '9999-10-01T09:00',
      end: '9999-11-02T10:00',
      heading: 'October 9999',
      month: 'December 9999',
      expected: ['November 9999', 'December 9999'],
      selectedStart: '9999-11-20T09:00',
      selectedEnd: '9999-11-21T10:00',
    },
  ])(
    'keeps the connected month window supported when choosing $month',
    async ({
      start,
      end,
      heading,
      month,
      expected,
      selectedStart,
      selectedEnd,
    }) => {
      const user = userEvent.setup();
      const onRangeChange = vi.fn();
      render(() => (
        <EventDateTimeRangeFields
          start={start}
          end={end}
          allDay={false}
          onRangeChange={onRangeChange}
          onAllDayChange={vi.fn()}
        />
      ));
      await user.click(
        screen.getByRole('button', { name: 'Edit event date and time range' })
      );
      await user.click(
        screen.getByRole('button', {
          name: `Choose month and year, currently ${heading}`,
        })
      );
      if (heading.endsWith('1000')) {
        expect(
          screen.getByRole('button', { name: 'Previous year' })
        ).toHaveProperty('disabled', true);
        await user.click(
          screen.getByRole('button', { name: 'Choose year, currently 1000' })
        );
        expect(
          screen.getByRole('button', { name: 'Previous years' })
        ).toHaveProperty('disabled', true);
        expect(
          screen.getByRole('grid', { name: 'Years 1000 to 1011' })
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: '999' })).toBeNull();
        await user.click(screen.getByRole('button', { name: '1000' }));
      }
      await user.click(screen.getByRole('button', { name: month }));
      for (const label of expected) {
        expect(
          screen.getByRole('button', {
            name: `Choose month and year, currently ${label}`,
          })
        ).toBeTruthy();
      }
      expect(onRangeChange).not.toHaveBeenCalled();
      const calendar = within(screen.getAllByRole('grid')[0]);
      await user.click(calendar.getByRole('gridcell', { name: '20' }));
      await user.click(calendar.getByRole('gridcell', { name: '21' }));
      expect(onRangeChange).toHaveBeenCalledExactlyOnceWith(
        selectedStart,
        selectedEnd
      );
    }
  );

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
