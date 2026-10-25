import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PropertyDateRangeSelector } from './PropertyDateRangeSelector';

vi.mock('@property/utils/focus', () => ({
  // Like the real helper, focus after the menu has taken focus on open.
  useAutoFocus: (element: () => HTMLElement | undefined) =>
    setTimeout(() => element()?.focus(), 100),
}));

afterEach(cleanup);

/** A day of the shown month; days of the months around it are disabled. */
const day = (label: string) =>
  screen
    .getAllByRole('gridcell')
    .find(
      (cell) => cell.textContent === label && !cell.hasAttribute('disabled')
    );

const end = (label: 'Start' | 'End') =>
  screen.getByRole('button', { name: new RegExp(`^${label}`) });

describe('PropertyDateRangeSelector', () => {
  it('sets the start, moves on to the end, and saves each complete change without closing', async () => {
    const onSelectRange = vi.fn();
    const onClose = vi.fn();
    render(() => (
      <PropertyDateRangeSelector
        label="Trip"
        selectedRange={{
          allDay: true,
          start: new Date(2026, 2, 2),
          end: new Date(2026, 2, 3),
        }}
        onSelectRange={onSelectRange}
        onClose={onClose}
      />
    ));

    await waitFor(() => expect(document.activeElement).toBe(day('2')));
    expect(end('Start').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(day('10')!);
    expect(onSelectRange).toHaveBeenLastCalledWith({
      allDay: true,
      start: new Date(2026, 2, 10),
      end: new Date(2026, 2, 10),
    });
    expect(end('End').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(day('16')!);
    expect(onSelectRange).toHaveBeenLastCalledWith({
      allDay: true,
      start: new Date(2026, 2, 10),
      end: new Date(2026, 2, 16),
    });
    expect(screen.getByText('7 days')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(day('16')).toBeTruthy();
  });

  it('sets whichever end is highlighted, swapping an end picked before the start', () => {
    const onSelectRange = vi.fn();
    render(() => (
      <PropertyDateRangeSelector
        label="Trip"
        selectedRange={{
          allDay: true,
          start: new Date(2026, 2, 10),
          end: new Date(2026, 2, 12),
        }}
        onSelectRange={onSelectRange}
      />
    ));

    fireEvent.click(end('End'));
    fireEvent.click(day('20')!);
    expect(onSelectRange).toHaveBeenLastCalledWith({
      allDay: true,
      start: new Date(2026, 2, 10),
      end: new Date(2026, 2, 20),
    });

    fireEvent.click(day('4')!);
    expect(onSelectRange).toHaveBeenLastCalledWith({
      allDay: true,
      start: new Date(2026, 2, 4),
      end: new Date(2026, 2, 10),
    });

    fireEvent.click(end('Start'));
    fireEvent.click(day('6')!);
    expect(onSelectRange).toHaveBeenLastCalledWith({
      allDay: true,
      start: new Date(2026, 2, 6),
      end: new Date(2026, 2, 10),
    });
  });

  it('turns All day off with 9 AM to 5 PM, and back on to whole days', () => {
    const onSelectRange = vi.fn();
    render(() => (
      <PropertyDateRangeSelector
        label="Trip"
        selectedRange={{
          allDay: true,
          start: new Date(2026, 2, 2),
          end: new Date(2026, 2, 3),
        }}
        onSelectRange={onSelectRange}
      />
    ));

    const allDay = screen.getByRole('switch', { name: 'All day' });
    expect(allDay).toHaveProperty('checked', true);
    expect(screen.queryByLabelText('Start time')).toBeNull();

    fireEvent.click(allDay);
    expect(onSelectRange).toHaveBeenLastCalledWith({
      allDay: false,
      start: new Date(2026, 2, 2, 9),
      end: new Date(2026, 2, 3, 17),
    });
    expect(screen.getByLabelText('Start time')).toHaveProperty(
      'value',
      '09:00'
    );
    expect(screen.getByLabelText('End time')).toHaveProperty('value', '17:00');
    expect(screen.getByText('1 day 8 hrs')).toBeTruthy();

    fireEvent.click(allDay);
    expect(onSelectRange).toHaveBeenLastCalledWith({
      allDay: true,
      start: new Date(2026, 2, 2),
      end: new Date(2026, 2, 3),
    });
    expect(screen.queryByLabelText('Start time')).toBeNull();
  });

  it('saves an edited time, and refuses an end before the start', () => {
    const onSelectRange = vi.fn();
    render(() => (
      <PropertyDateRangeSelector
        label="Meeting"
        selectedRange={{
          allDay: false,
          start: new Date(2026, 2, 2, 9),
          end: new Date(2026, 2, 2, 17),
        }}
        onSelectRange={onSelectRange}
      />
    ));

    expect(screen.getByRole('switch', { name: 'All day' })).toHaveProperty(
      'checked',
      false
    );
    expect(screen.getByText('8 hrs')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('End time'), {
      target: { value: '18:30' },
    });
    expect(onSelectRange).toHaveBeenLastCalledWith({
      allDay: false,
      start: new Date(2026, 2, 2, 9),
      end: new Date(2026, 2, 2, 18, 30),
    });
    expect(screen.getByText('9 hrs 30 mins')).toBeTruthy();

    onSelectRange.mockClear();
    fireEvent.change(screen.getByLabelText('End time'), {
      target: { value: '08:00' },
    });
    expect(onSelectRange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(
      "The end can't be before the start."
    );

    fireEvent.change(screen.getByLabelText('Start time'), {
      target: { value: '07:45' },
    });
    expect(onSelectRange).toHaveBeenLastCalledWith({
      allDay: false,
      start: new Date(2026, 2, 2, 7, 45),
      end: new Date(2026, 2, 2, 8),
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clears a set range and closes', () => {
    const onSelectRange = vi.fn();
    const onClose = vi.fn();
    render(() => (
      <PropertyDateRangeSelector
        label="Trip"
        selectedRange={{
          allDay: true,
          start: new Date(2026, 2, 2),
          end: new Date(2026, 2, 3),
        }}
        onSelectRange={onSelectRange}
        onClose={onClose}
      />
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onSelectRange).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalled();
  });
});
