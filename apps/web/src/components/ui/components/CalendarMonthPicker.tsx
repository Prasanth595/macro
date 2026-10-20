import { Popover as KPopover } from '@kobalte/core/popover';
import CaretDownIcon from '@phosphor/caret-down.svg';
import CaretLeftIcon from '@phosphor/caret-left.svg';
import CaretRightIcon from '@phosphor/caret-right.svg';
import { createSignal, Index, Show, untrack } from 'solid-js';
import { Button } from './Button';
import { Layer } from './Layer';

const months = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(2000, index, 1);
  return {
    short: date.toLocaleDateString(undefined, { month: 'short' }),
    long: date.toLocaleDateString(undefined, { month: 'long' }),
  };
});
const formatMonth = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
}).format;
// Event dates require four-digit years; Corvu also remaps years below 100.
export const MIN_CALENDAR_YEAR = 1000;
export const MAX_CALENDAR_YEAR = 9999;
const firstYearOnPage = (year: number) =>
  MIN_CALENDAR_YEAR + Math.floor((year - MIN_CALENDAR_YEAR) / 12) * 12;
const clampYear = (year: number) =>
  Math.max(MIN_CALENDAR_YEAR, Math.min(MAX_CALENDAR_YEAR, year));
const calendarMonth = (year: number, month: number) => {
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month, 1);
  return date;
};

export type CalendarMonthPickerProps = {
  month: Date;
  onChange: (month: Date) => void;
};

/** Month/year drill-down. Changes the visible month, never the selected date. */
export function CalendarMonthPicker(props: CalendarMonthPickerProps) {
  const today = new Date();
  const [open, setOpen] = createSignal(false);
  const [view, setView] = createSignal<'months' | 'years'>('months');
  const [year, setYear] = createSignal(clampYear(props.month.getFullYear()));
  const [yearPage, setYearPage] = createSignal(firstYearOnPage(year()));
  const [cursor, setCursor] = createSignal(props.month.getMonth());
  const cells: HTMLButtonElement[] = [];
  const showingYears = () => view() === 'years';
  const itemCount = () =>
    showingYears() ? Math.min(12, MAX_CALENDAR_YEAR + 1 - yearPage()) : 12;
  const lastYear = () => yearPage() + itemCount() - 1;
  const rows = () =>
    Array.from({ length: Math.ceil(itemCount() / 3) }, (_, row) =>
      Array.from(
        { length: Math.min(3, itemCount() - row * 3) },
        (_, column) => row * 3 + column
      )
    );

  const changeOpen = (next: boolean) => {
    if (next) {
      const selectedYear = clampYear(props.month.getFullYear());
      setYear(selectedYear);
      setYearPage(firstYearOnPage(selectedYear));
      setView('months');
      setCursor(props.month.getMonth());
    }
    setOpen(next);
  };
  const focusCell = (index: number) => {
    const next = Math.max(0, Math.min(itemCount() - 1, index));
    setCursor(next);
    queueMicrotask(() => {
      const cell = cells[next];
      if (cell?.isConnected) cell.focus();
    });
  };
  const toggleView = () => {
    if (showingYears()) {
      setView('months');
      focusCell(props.month.getMonth());
    } else {
      const page = firstYearOnPage(year());
      setYearPage(page);
      setView('years');
      focusCell(year() - page);
    }
  };
  const navigate = (direction: -1 | 1) => {
    if (showingYears()) {
      setYearPage((page) =>
        Math.max(
          MIN_CALENDAR_YEAR,
          Math.min(firstYearOnPage(MAX_CALENDAR_YEAR), page + direction * 12)
        )
      );
      setCursor((index) => Math.min(index, itemCount() - 1));
    } else {
      setYear((value) => clampYear(value + direction));
    }
  };
  const chooseMonth = (month: Date) => {
    props.onChange(month);
    setOpen(false);
  };
  const chooseCell = (index: number) => {
    if (showingYears()) {
      setYear(yearPage() + index);
      setView('months');
      focusCell(props.month.getMonth());
    } else {
      chooseMonth(calendarMonth(year(), index));
    }
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.metaKey) return;
    let next = cursor();
    if (event.key === 'ArrowRight') next += 1;
    else if (event.key === 'ArrowLeft') next -= 1;
    else if (event.key === 'ArrowDown') next += 3;
    else if (event.key === 'ArrowUp') next -= 3;
    else if (event.key === 'Home')
      next = event.ctrlKey ? 0 : Math.floor(next / 3) * 3;
    else if (event.key === 'End')
      next = event.ctrlKey ? itemCount() - 1 : Math.floor(next / 3) * 3 + 2;
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      navigate(event.key === 'PageUp' ? -1 : 1);
    } else return;
    event.preventDefault();
    event.stopPropagation();
    focusCell(next);
  };

  return (
    <KPopover
      modal
      open={open()}
      onOpenChange={changeOpen}
      placement="bottom-start"
      gutter={8}
      fitViewport
      overflowPadding={16}
    >
      <KPopover.Trigger
        as={Button}
        variant="ghost"
        size="md"
        aria-label={`Choose month and year, currently ${formatMonth(props.month)}`}
        class="h-7 max-w-full min-w-0 justify-start gap-1 rounded-lg px-1 text-xs font-medium focus-visible:bg-active focus-visible:outline-none focus-visible:ring-0 touch:min-h-[44px]"
      >
        <span class="min-w-0 truncate">{formatMonth(props.month)}</span>
        <CaretDownIcon class="size-4 shrink-0 text-ink-extra-muted" />
      </KPopover.Trigger>
      <KPopover.Portal>
        <Layer depth={4}>
          <KPopover.Content
            class="portal-scope z-action-menu w-64 max-w-[var(--kb-popper-content-available-width)] max-h-[var(--kb-popper-content-available-height)] overflow-y-auto rounded-2xl border border-edge bg-menu-glass p-4 text-ink outline-none glass menu-open-animation"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              // Kobalte dispatches autofocus inside an effect; do not subscribe it to picker state.
              untrack(() => focusCell(props.month.getMonth()));
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }}
          >
            <KPopover.Title class="sr-only">
              Choose month and year
            </KPopover.Title>
            <div class="mb-4 flex items-center gap-2">
              <Button
                size="icon-md"
                variant="ghost"
                class="focus-visible:bg-active focus-visible:outline-none focus-visible:ring-0"
                aria-label={showingYears() ? 'Previous years' : 'Previous year'}
                disabled={
                  showingYears()
                    ? yearPage() === MIN_CALENDAR_YEAR
                    : year() === MIN_CALENDAR_YEAR
                }
                onClick={() => navigate(-1)}
              >
                <CaretLeftIcon class="size-4" />
              </Button>
              <Button
                size="md"
                variant="ghost"
                class="min-w-0 flex-1 gap-2 font-medium tabular-nums focus-visible:bg-active focus-visible:outline-none focus-visible:ring-0"
                aria-label={
                  showingYears()
                    ? `Show months for ${year()}`
                    : `Choose year, currently ${year()}`
                }
                onClick={toggleView}
              >
                {showingYears() ? `${yearPage()}–${lastYear()}` : year()}
                <CaretDownIcon
                  class="size-4 text-ink-extra-muted"
                  classList={{ 'rotate-180': showingYears() }}
                />
              </Button>
              <Button
                size="icon-md"
                variant="ghost"
                class="focus-visible:bg-active focus-visible:outline-none focus-visible:ring-0"
                aria-label={showingYears() ? 'Next years' : 'Next year'}
                disabled={
                  showingYears()
                    ? lastYear() === MAX_CALENDAR_YEAR
                    : year() === MAX_CALENDAR_YEAR
                }
                onClick={() => navigate(1)}
              >
                <CaretRightIcon class="size-4" />
              </Button>
            </div>
            <div
              role="grid"
              class="grid gap-2"
              aria-label={
                showingYears()
                  ? `Years ${yearPage()} to ${lastYear()}`
                  : `Months in ${year()}`
              }
              onKeyDown={handleKeyDown}
            >
              <Index each={rows()}>
                {(row) => (
                  <div role="row" class="grid grid-cols-3 gap-2">
                    <Index each={row()}>
                      {(index) => {
                        const selected = () =>
                          showingYears()
                            ? yearPage() + index() === year()
                            : year() === props.month.getFullYear() &&
                              index() === props.month.getMonth();
                        const current = () =>
                          showingYears()
                            ? yearPage() + index() === today.getFullYear()
                            : year() === today.getFullYear() &&
                              index() === today.getMonth();
                        return (
                          <div role="gridcell" aria-selected={selected()}>
                            <Button
                              ref={(element) => {
                                cells[index()] = element;
                              }}
                              variant={selected() ? 'accent' : 'ghost'}
                              class="relative h-10 w-full rounded-lg px-2 font-normal tabular-nums focus-visible:bg-active focus-visible:outline-none focus-visible:ring-0 touch:min-h-[44px]"
                              aria-label={
                                showingYears()
                                  ? String(yearPage() + index())
                                  : `${months[index()].long} ${year()}`
                              }
                              aria-current={current() ? 'date' : undefined}
                              tabIndex={cursor() === index() ? 0 : -1}
                              onFocus={() => setCursor(index())}
                              onClick={() => chooseCell(index())}
                            >
                              {showingYears()
                                ? yearPage() + index()
                                : months[index()].short}
                              <Show when={current()}>
                                <span
                                  aria-hidden="true"
                                  class="absolute bottom-1 size-1 rounded-full bg-accent"
                                />
                              </Show>
                            </Button>
                          </div>
                        );
                      }}
                    </Index>
                  </div>
                )}
              </Index>
            </div>
            <div class="mt-4 border-t border-edge-muted pt-2">
              <Button
                size="md"
                variant="ghost"
                class="w-full focus-visible:bg-active focus-visible:outline-none focus-visible:ring-0"
                onClick={() =>
                  chooseMonth(
                    calendarMonth(today.getFullYear(), today.getMonth())
                  )
                }
              >
                This month
              </Button>
            </div>
          </KPopover.Content>
        </Layer>
      </KPopover.Portal>
    </KPopover>
  );
}
