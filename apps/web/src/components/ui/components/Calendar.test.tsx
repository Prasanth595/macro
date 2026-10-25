import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type CalendarRange, RangeCalendar } from './Calendar';

afterEach(cleanup);

function Fixture(props: { onValueChange: (range: CalendarRange) => void }) {
  const [range, setRange] = createSignal<CalendarRange>({
    from: null,
    to: null,
  });
  return (
    <RangeCalendar
      value={range()}
      onValueChange={(next) => {
        setRange(next);
        props.onValueChange(next);
      }}
      initialMonth={new Date(2026, 2, 1)}
      initialFocusedDay={new Date(2026, 2, 16)}
    />
  );
}

/** A day of the shown month; days of the months around it are disabled. */
const day = (label: string) =>
  screen
    .getAllByRole('gridcell')
    .find(
      (cell) => cell.textContent === label && !cell.hasAttribute('disabled')
    );

describe('RangeCalendar', () => {
  it('starts a range on the first day picked and ends it on the second, in order', () => {
    const onValueChange = vi.fn();
    render(() => <Fixture onValueChange={onValueChange} />);

    fireEvent.click(day('18')!);
    fireEvent.click(day('16')!);

    expect(onValueChange).toHaveBeenNthCalledWith(1, {
      from: new Date(2026, 2, 18),
      to: null,
    });
    expect(onValueChange).toHaveBeenLastCalledWith({
      from: new Date(2026, 2, 16),
      to: new Date(2026, 2, 18),
    });
    expect(day('17')?.getAttribute('aria-selected')).toBe('true');
    expect(day('19')?.getAttribute('aria-selected')).toBe('false');
  });

  it('moves between days with the arrow keys', () => {
    render(() => <Fixture onValueChange={vi.fn()} />);

    day('16')?.focus();
    fireEvent.keyDown(day('16')!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(day('17'));
    fireEvent.keyDown(day('17')!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(day('24'));
  });

  it('draws the days between the ends as one band, capped where a week wraps', () => {
    render(() => (
      <RangeCalendar
        value={{ from: new Date(2026, 2, 5), to: new Date(2026, 2, 10) }}
      />
    ));
    // Weeks start on Monday: the 8th ends one, the 9th starts the next.
    const band = (label: string) => {
      const cell = day(label)!.parentElement!;
      return [
        cell.getAttribute('data-band'),
        cell.hasAttribute('data-band-cap-left'),
        cell.hasAttribute('data-band-cap-right'),
      ];
    };

    expect(band('4')).toEqual([null, false, false]);
    expect(band('5')).toEqual(['start', false, false]);
    expect(band('7')).toEqual(['between', false, false]);
    expect(band('8')).toEqual(['between', false, true]);
    expect(band('9')).toEqual(['between', true, false]);
    expect(band('10')).toEqual(['end', false, false]);
    expect(band('11')).toEqual([null, false, false]);
    expect(day('5')?.hasAttribute('data-start-day')).toBe(true);
    expect(day('10')?.hasAttribute('data-end-day')).toBe(true);
    expect(day('7')?.hasAttribute('data-start-day')).toBe(false);
  });

  it('draws a one-day range as its day alone', () => {
    render(() => (
      <RangeCalendar
        value={{ from: new Date(2026, 2, 5), to: new Date(2026, 2, 5) }}
      />
    ));

    expect(day('5')?.parentElement?.hasAttribute('data-band')).toBe(false);
    expect(day('5')?.hasAttribute('data-start-day')).toBe(true);
    expect(day('5')?.hasAttribute('data-end-day')).toBe(true);
  });

  it('hands picked days to the caller in place of its own picking', () => {
    const onPickDay = vi.fn();
    const onValueChange = vi.fn();
    render(() => (
      <RangeCalendar
        value={{ from: new Date(2026, 2, 5), to: new Date(2026, 2, 10) }}
        onValueChange={onValueChange}
        onPickDay={onPickDay}
      />
    ));

    fireEvent.click(day('20')!);
    expect(onPickDay).toHaveBeenCalledExactlyOnceWith(new Date(2026, 2, 20));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
