import { cleanup, fireEvent, render, within } from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CrmCaptureDemo } from './CrmCaptureDemo';

let intersections: IntersectionObserverCallback[];
let reduced = false;
beforeEach(() => {
  intersections = [];
  reduced = false;
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reduced;
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersections.push(callback);
      }
      observe() {}
      disconnect() {}
    }
  );
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
  vi.advanceTimersByTime(100);
  expect(fetch).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function visible(value: boolean) {
  for (const callback of intersections)
    callback(
      [{ isIntersecting: value } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
}
const stage = (view: ReturnType<typeof render>) =>
  view.getByRole('button', { name: 'Change Stage' }).textContent;
const owner = (view: ReturnType<typeof render>) =>
  view.getByRole('button', { name: 'Change Owner' }).textContent;

it('types the request before sending, acknowledges it, updates the record, then confirms and loops', () => {
  const view = render(() => <CrmCaptureDemo />);
  const input = view.getByRole('textbox', { name: 'Comment on company' });
  expect((input as HTMLTextAreaElement).value).toBe('');
  vi.advanceTimersByTime(10000);
  expect((input as HTMLTextAreaElement).value).toBe('');
  visible(true);
  vi.advanceTimersByTime(1500);
  expect((input as HTMLTextAreaElement).value).toBe('@Claud');
  expect(view.queryByText(/I’ll update the stage/)).toBeNull();
  visible(false);
  const draft = (input as HTMLTextAreaElement).value;
  vi.advanceTimersByTime(10000);
  expect((input as HTMLTextAreaElement).value).toBe(draft);
  visible(true);
  // Observe each actual transition, including the acknowledgment before updates.
  for (
    let elapsed = 0;
    elapsed < 20000 && !view.queryByText(/I’ll update the stage/);
    elapsed += 100
  )
    vi.advanceTimersByTime(100);
  expect(view.getByText(/I’ll update the stage/)).toBeTruthy();
  expect((input as HTMLTextAreaElement).value).toBe('');
  expect(view.getByText('@Claude')).toBeTruthy();
  expect(stage(view)).toContain('Lead');
  expect(owner(view)).toContain('Empty');
  vi.advanceTimersByTime(1400);
  expect(stage(view)).toContain('Demo');
  expect(owner(view)).toContain('Empty');
  vi.advanceTimersByTime(1400);
  expect(owner(view)).toContain('Jacob');
  expect(view.queryByText(/Done. Parlor Studio/)).toBeNull();
  vi.advanceTimersByTime(1400);
  expect(view.getByText(/Done. Parlor Studio/)).toBeTruthy();
  expect(view.container.querySelector('.demo-cursor')).toBeNull();
  vi.advanceTimersByTime(8000);
  expect(stage(view)).toContain('Lead');
  expect(owner(view)).toContain('Empty');
  expect((input as HTMLTextAreaElement).value).toBe('');
  expect(view.queryByText(/Done. Parlor Studio/)).toBeNull();
});

it('stops the walkthrough when a visitor takes over the record', () => {
  const view = render(() => <CrmCaptureDemo />);
  visible(true);
  vi.advanceTimersByTime(900);
  fireEvent.pointerDown(
    view.getByRole('group', {
      name: 'Claude updates Parlor Studio from a comment in its Discussion',
    })
  );
  vi.advanceTimersByTime(20000);
  expect(stage(view)).toContain('Lead');
  expect(owner(view)).toContain('Empty');
  expect(view.queryByText(/Parlor Studio is in Demo/)).toBeNull();
  expect(view.container.querySelector('.demo-cursor')).toBeNull();
});

it('shows the updated record and the reply at once with reduced motion', () => {
  reduced = true;
  const view = render(() => <CrmCaptureDemo />);
  expect(stage(view)).toContain('Demo');
  expect(owner(view)).toContain('Jacob');
  expect(view.getByText(/Parlor Studio is in Demo/)).toBeTruthy();
  expect(view.container.querySelector('.demo-cursor')).toBeNull();
});

it('posts a visitor’s comment and thread reply in the company Discussion', () => {
  const view = render(() => <CrmCaptureDemo />);
  const comment = view.getByRole('textbox', { name: 'Comment on company' });
  expect(comment.getAttribute('placeholder')).toBe('Leave a comment...');
  fireEvent.input(comment, {
    target: { value: 'Ava confirmed 12 seats.' },
  });
  fireEvent.keyDown(comment, { key: 'Enter' });
  expect(view.getByText('Ava confirmed 12 seats.')).toBeTruthy();
  const thread = view.container.querySelector<HTMLElement>('[data-thread-id]');
  fireEvent.click(within(thread!).getByRole('button', { name: 'Reply' }));
  const reply = view.getByRole('textbox', { name: 'Thread reply' });
  expect(reply.getAttribute('placeholder')).toBe('Send a reply');
  fireEvent.input(reply, { target: { value: 'On it.' } });
  fireEvent.keyDown(reply, { key: 'Enter' });
  expect(within(thread!).getByText('On it.')).toBeTruthy();
});

it('preserves a visitor’s edit in the middle of the typed CRM request', () => {
  const view = render(() => <CrmCaptureDemo />);
  visible(true);
  vi.advanceTimersByTime(2000);
  const input = view.getByRole<HTMLTextAreaElement>('textbox', {
    name: 'Comment on company',
  });
  expect(input.value.startsWith('@Claude')).toBe(true);
  expect(input.value.includes('rollout')).toBe(false);
  fireEvent.pointerDown(input);
  fireEvent.input(input, { target: { value: 'Keep my own request.' } });
  vi.advanceTimersByTime(30000);
  expect(input.value).toBe('Keep my own request.');
  expect(stage(view)).toContain('Lead');
});
