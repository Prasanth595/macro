import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createComponent, createSignal } from 'solid-js';
import { insert } from 'solid-js/web';
import { afterEach, expect, it, vi } from 'vitest';
import { Gantt, useGantt } from './gantt';
import { toGanttDay } from './gantt-date';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function fixture(drawer = false) {
  const viewport = document.createElement('div');
  let context!: ReturnType<typeof useGantt>;
  Object.defineProperty(viewport, 'clientWidth', { value: 1000 });
  viewport.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 600);
  render(() =>
    createComponent(Gantt.Root, {
      labelWidth: drawer ? 0 : undefined,
      range: {
        start: toGanttDay('2026-03-01')!,
        end: toGanttDay('2026-06-01')!,
      },
      get children() {
        return createComponent(() => {
          const gantt = useGantt();
          context = gantt;
          gantt.setViewport(viewport);
          gantt.updateViewport();
          insert(
            viewport,
            createComponent(Gantt.Row, {
              get children() {
                return createComponent(Gantt.Bar, {
                  start: '2026-03-08',
                  end: '2026-03-10',
                  title: 'Example',
                  children: 'Example',
                });
              },
            })
          );
          return viewport;
        }, {});
      },
    })
  );
  const element = viewport.querySelector<HTMLElement>('[data-gantt-bar]')!;
  return {
    element: () => element,
    scrollTo: (left: number) => {
      viewport.scrollLeft = left;
      context.updateViewport();
    },
  };
}

it('renders a read-only bar with no resize handle, preview, or keyboard date change', () => {
  const bar = fixture();
  const end = bar.element().dataset.ganttEnd;
  const width = bar.element().style.width;
  expect(screen.queryByRole('button', { name: /Resize end date/ })).toBeNull();
  expect(bar.element().querySelectorAll('button')).toHaveLength(1);
  const button = screen.getByRole('button', { name: /Example/ });
  fireEvent.keyDown(button, { key: 'ArrowRight' });
  fireEvent.keyDown(button, { key: 'ArrowLeft', shiftKey: true });
  fireEvent.pointerDown(button, { button: 0, clientX: 500 });
  fireEvent.pointerMove(window, { clientX: 540 });
  fireEvent.pointerUp(window, { clientX: 540 });
  expect(bar.element().dataset.ganttEnd).toBe(end);
  expect(bar.element().style.width).toBe(width);
  expect(screen.queryByRole('status')).toBeNull();
  expect(document.querySelector('[data-gantt-resize-preview]')).toBeNull();
});

it.each([false, true])(
  'keeps the read-only bar clipped while scrolling (drawer: %s)',
  (drawer) => {
    const bar = fixture(drawer);
    bar.scrollTo(170);
    const body = bar
      .element()
      .querySelector<HTMLElement>('[data-gantt-bar-body]')!;
    const clip = body.closest<HTMLElement>('[data-gantt-calendar-clip]')!;
    expect(clip.style.left).toBe(drawer ? '0px' : '260px');
    expect(clip.classList.contains('sticky')).toBe(true);
    const boundary = clip.style.clipPath;
    bar.scrollTo(190);
    expect(clip.style.clipPath).toBe(boundary);
  }
);

it('uses native sticky text bounded by the bar through scrolling, zoom, and narrow panes', async () => {
  const viewport = document.createElement('div');
  let width = 500;
  Object.defineProperty(viewport, 'clientWidth', { get: () => width });
  let gantt!: ReturnType<typeof useGantt>;
  const view = render(() =>
    createComponent(Gantt.Root, {
      range: { start: 0, end: 100 },
      get children() {
        return createComponent(() => {
          gantt = useGantt();
          gantt.setViewport(viewport);
          gantt.updateViewport();
          return createComponent(Gantt.Bar, {
            start: '1970-01-06',
            end: '1970-02-10',
            children: 'A long timeline',
          });
        }, {});
      },
    })
  );
  const bar = view.container.querySelector<HTMLElement>('[data-gantt-bar]')!;
  const label = bar.querySelector<HTMLElement>('[data-gantt-bar-label]')!;
  const button = label.closest('button')!;
  expect(label.classList.contains('sticky')).toBe(true);
  expect(label.classList.contains('max-w-full')).toBe(true);
  expect(label.classList.contains('overflow-hidden')).toBe(true);
  expect(button.classList.contains('overflow-hidden')).toBe(false);
  expect(label.style.left).toBe('150px');
  expect(label.style.width).toBe('');
  expect(bar.style.width).toBe('720px');

  viewport.scrollLeft = 200;
  gantt.updateViewport();
  expect(label.style.left).toBe('150px');
  gantt.setScale('month');
  await Promise.resolve();
  expect(bar.style.width).toBe('216px');
  expect(label.style.left).toBe('150px');

  width = 300;
  gantt.updateViewport();
  expect(label.style.left).toBe('128px');
  viewport.scrollLeft = 41 * gantt.pixelsPerDay();
  gantt.updateViewport();
  expect(label.style.left).toBe('128px');
  expect(label.style.width).toBe('');
  expect(bar.querySelector('[data-gantt-calendar-clip]')).not.toBeNull();
});

it('keeps sticky bar text outside the open drawer without scrolling calculations', () => {
  const bar = fixture(true);
  const label = bar
    .element()
    .querySelector<HTMLElement>('[data-gantt-bar-label]')!;
  expect(label.style.left).toBe('280px');
  bar.scrollTo(190);
  expect(label.style.left).toBe('280px');
});

it('strengthens deadline gradients on calendar days without warning on undated, inactive, or clipped ends', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 3, 12));
  const [end, setEnd] = createSignal<string | null>('2026-03-11');
  const [enabled, setEnabled] = createSignal(true);
  const view = render(() =>
    createComponent(Gantt.Root, {
      range: {
        start: toGanttDay('2026-03-01')!,
        end: toGanttDay('2026-03-21')!,
      },
      defaultScale: 'day',
      get children() {
        return createComponent(Gantt.Bar, {
          start: '2026-03-01',
          get end() {
            return end();
          },
          get deadlineWarning() {
            return enabled();
          },
        });
      },
    })
  );
  const warning = () =>
    view.container.querySelector<HTMLElement>('[data-gantt-end-warning]');
  const fill = () =>
    view.container.querySelector<HTMLElement>('[data-gantt-bar-fill]')!;
  expect(warning()).toBeNull();
  expect(fill().style.maskImage).toBe('');
  setEnd('2026-03-10');
  const distant = Number(warning()!.dataset.ganttEndWarning);
  expect(warning()).toBe(fill());
  expect(fill().style.opacity).toBe('');
  expect(fill().style.getPropertyValue('--gantt-bar-gradient')).toContain(
    'linear-gradient(to left, color-mix(in oklch, var(--color-failure-ink)'
  );
  setEnd('2026-03-04');
  expect(Number(warning()!.dataset.ganttEndWarning)).toBeGreaterThan(distant);
  setEnd('2026-03-03');
  expect(Number(warning()!.dataset.ganttEndWarning)).toBe(0.35);
  setEnd('2026-03-02');
  expect(Number(warning()!.dataset.ganttEndWarning)).toBe(0.35);
  setEnabled(false);
  expect(warning()).toBeNull();
  setEnabled(true);
  setEnd(null);
  expect(warning()).toBeNull();
  expect(fill().style.maskImage).toBe(
    'linear-gradient(to right, black 65%, transparent 100%)'
  );
  expect(fill().parentElement!.style.maskImage).toBe('');
  expect(screen.queryByRole('button', { name: /Resize end date/ })).toBeNull();
  vi.setSystemTime(new Date(2026, 2, 28, 12));
  fireEvent.focus(window);
  setEnd('2026-03-30');
  expect(warning()).toBeNull();
});

it('refreshes all deadline gradients and Today at local midnight and on tab resume, then clears the shared timer', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date(2026, 2, 7, 23, 59, 59));
  const view = render(() =>
    createComponent(Gantt.Root, {
      range: {
        start: toGanttDay('2026-03-01')!,
        end: toGanttDay('2026-03-21')!,
      },
      defaultScale: 'day',
      get children() {
        return [
          createComponent(Gantt.Bar, {
            start: '2026-03-01',
            end: '2026-03-15',
          }),
          createComponent(Gantt.Bar, {
            start: '2026-03-01',
            end: '2026-03-08',
          }),
          createComponent(Gantt.TodayMarker, {}),
        ];
      },
    })
  );
  const strength = (end: string) =>
    Number(
      view.container.querySelector<HTMLElement>(
        `[data-gantt-end="${toGanttDay(end)}"] [data-gantt-end-warning]`
      )?.dataset.ganttEndWarning ?? 0
    );
  const todayLeft = () =>
    Number.parseFloat(
      view.container.querySelector<HTMLElement>('[data-gantt-today]')!.style
        .left
    );
  const initialLeft = todayLeft();
  expect(strength('2026-03-15')).toBe(0);
  expect(strength('2026-03-08')).toBeLessThan(0.35);
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(strength('2026-03-15')).toBeGreaterThan(0);
  expect(strength('2026-03-08')).toBe(0.35);
  expect(todayLeft()).toBe(initialLeft + 40);
  // Local calendar midnights can be 23 or 25 hours apart across DST.
  await vi.advanceTimersByTimeAsync(
    new Date(2026, 2, 9).getTime() - new Date(2026, 2, 8).getTime()
  );
  expect(todayLeft()).toBe(initialLeft + 80);
  expect(vi.getTimerCount()).toBe(1);
  const previous = strength('2026-03-15');
  const visibility = vi.spyOn(document, 'visibilityState', 'get');
  visibility.mockReturnValue('hidden');
  vi.setSystemTime(new Date(2026, 2, 12, 12));
  fireEvent(document, new Event('visibilitychange'));
  expect(strength('2026-03-15')).toBe(previous);
  visibility.mockReturnValue('visible');
  fireEvent(document, new Event('visibilitychange'));
  expect(strength('2026-03-15')).toBeGreaterThan(previous);
  expect(vi.getTimerCount()).toBe(1);
  view.unmount();
  fireEvent.focus(window);
  fireEvent(document, new Event('visibilitychange'));
  expect(vi.getTimerCount()).toBe(0);
});
