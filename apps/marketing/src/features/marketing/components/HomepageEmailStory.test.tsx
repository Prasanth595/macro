import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HomepageEmailStory } from './HomepageEmailStory';

let observers: Map<Element, IntersectionObserverCallback>;
let reduced = false;
beforeEach(() => {
  observers = new Map();
  reduced = false;
  vi.useFakeTimers();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(element: Element) {
        observers.set(element, this.callback);
      }
      disconnect() {}
    }
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function visibility(element: Element, visible: boolean) {
  observers.get(element)!(
    [
      {
        target: element,
        isIntersecting: visible,
        intersectionRatio: visible ? 1 : 0,
      } as IntersectionObserverEntry,
    ],
    {} as IntersectionObserver
  );
}

it('reveals messages in order before enabling the draft, only while visible', () => {
  const view = render(() => <HomepageEmailStory />);
  const story = view.container.querySelector('.homepage-email-workspace')!;
  const chat = view.getByRole('region', { name: 'Launch channel' });
  vi.advanceTimersByTime(5000);
  expect(story.getAttribute('data-step')).toBe('0');
  visibility(chat, true);
  vi.advanceTimersByTime(200);
  expect(story.getAttribute('data-step')).toBe('1');
  expect(
    view.getByText('Can you send Valentina the demo follow-up?')
  ).toBeTruthy();
  expect(view.queryByText('Here’s a draft based on the call.')).toBeNull();
  visibility(chat, false);
  vi.advanceTimersByTime(5000);
  expect(story.getAttribute('data-step')).toBe('1');
  visibility(chat, true);
  vi.advanceTimersByTime(1200);
  expect(story.getAttribute('data-step')).toBe('2');
  vi.advanceTimersByTime(1000);
  expect(story.getAttribute('data-step')).toBe('3');
  visibility(chat, false);
  visibility(chat, true);
  vi.advanceTimersByTime(5000);
  expect(story.getAttribute('data-step')).toBe('3');
});

it('shows the complete story for reduced motion or user interaction', () => {
  reduced = true;
  const first = render(() => <HomepageEmailStory />);
  expect(
    first.container
      .querySelector('.homepage-email-workspace')
      ?.getAttribute('data-step')
  ).toBe('3');
  first.unmount();
  reduced = false;
  const second = render(() => <HomepageEmailStory />);
  const story = second.container.querySelector('.homepage-email-workspace')!;
  fireEvent.pointerDown(story);
  expect(story.getAttribute('data-step')).toBe('3');
  visibility(second.getByRole('region', { name: 'Launch channel' }), true);
  vi.advanceTimersByTime(5000);
  expect(story.getAttribute('data-step')).toBe('3');
});

it('keeps a visitor’s channel message when they continue interacting', () => {
  const view = render(() => <HomepageEmailStory />);
  const story = view.container.querySelector('.homepage-email-workspace')!;
  fireEvent.pointerDown(story);
  const editor = view.getByRole('textbox', { name: 'Message #launch' });
  editor.textContent = 'I will check the rollout dates.';
  fireEvent.input(editor);
  fireEvent.click(view.getByRole('button', { name: 'Send demo message' }));
  fireEvent.pointerDown(story);
  expect(view.getByText('I will check the rollout dates.')).toBeTruthy();
  expect(story.getAttribute('data-step')).toBe('3');
});

it('opens Ask Macro in the native shared-work pane and returns to the channel', () => {
  const view = render(() => <HomepageEmailStory />);
  fireEvent.click(view.getByRole('button', { name: 'Ask Macro' }));
  expect(view.getByRole('region', { name: 'Shared work' })).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'Close shared work' }));
  expect(view.queryByRole('region', { name: 'Shared work' })).toBeNull();
  expect(view.getByRole('textbox', { name: 'Message #launch' })).toBeTruthy();
});
