import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HomepageDemoCarousel } from './HomepageDemoCarousel';

let frame: HTMLIFrameElement;
let openView = vi.fn<(label: string | null) => void>();
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  frame = document.createElement('iframe');
  document.body.append(frame);
  frame.contentDocument!.body.innerHTML = `<div class="dummy-rail">${['Home', 'Chat', 'Drive', 'Tasks', 'Customers', 'Agents'].map((label) => `<button aria-label="${label}">${label}</button>`).join('')}</div><div class="dummy-sidebar"><button>Homepage feedback</button><button>Fix the deploy pipeline</button></div>`;
  openView = vi.fn();
  frame.contentDocument!.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => openView(button.textContent));
  });
});
afterEach(() => {
  cleanup();
  frame.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function mountCarousel() {
  return render(() => <HomepageDemoCarousel frame={() => frame} />);
}
it('starts with the unified Home example and wraps the highlights with keyboard navigation', () => {
  mountCarousel();
  expect(openView.mock.calls.map((call) => call[0])).toEqual(['Home']);
  fireEvent.click(screen.getByRole('button', { name: 'Previous highlight' }));
  expect(
    screen
      .getByRole('button', { name: 'Show Agents highlight' })
      .getAttribute('aria-pressed')
  ).toBe('true');
  expect(openView).toHaveBeenLastCalledWith('Fix the deploy pipeline');
  fireEvent.keyDown(screen.getByRole('button', { name: 'Next highlight' }), {
    key: 'ArrowRight',
  });
  expect(screen.getByRole('heading').textContent).toContain(
    'Catch up on all your work.'
  );
});
it('keeps the carousel in place during iframe interaction and cleans up load listeners', () => {
  const view = mountCarousel();
  const heading = screen.getByRole('heading');
  frame.contentDocument!.dispatchEvent(
    new Event('pointerdown', { bubbles: true })
  );
  frame.contentDocument!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'a', bubbles: true })
  );
  expect(screen.getByRole('heading')).toBe(heading);
  expect(screen.getByRole('button', { name: 'Next highlight' })).toBeTruthy();
  expect(screen.queryByText('Back to highlights')).toBeNull();
  expect(document.querySelector('iframe')).toBe(frame);
  frame
    .contentDocument!.querySelector<HTMLButtonElement>('[aria-label=Chat]')!
    .click();
  expect(screen.getByRole('heading').textContent).toContain(
    'Chat with your team and your agents.'
  );
  view.unmount();
  openView.mockClear();
  fireEvent.load(frame);
  expect(openView).not.toHaveBeenCalled();
});

it('captures horizontal drags and ignores vertical or cancelled gestures', () => {
  mountCarousel();
  const pointer = (
    type: string,
    target: Element,
    values: { clientX: number; clientY: number }
  ) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, ...values });
    Object.defineProperties(event, {
      pointerId: { value: 1 },
      isPrimary: { value: true },
    });
    fireEvent(target, event);
  };
  const carousel = screen.getByRole('region');
  const capture = vi.fn();
  carousel.setPointerCapture = capture;
  const down = {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: 300,
    clientY: 100,
  };
  pointer('pointerdown', screen.getByRole('heading'), down);
  expect(capture).toHaveBeenCalledWith(1);
  pointer('pointerup', carousel, { ...down, clientX: 200 });
  expect(screen.getByRole('heading').textContent).toContain(
    'Chat with your team and your agents.'
  );

  pointer('pointerdown', carousel, down);
  pointer('pointerup', carousel, { ...down, clientX: 400 });
  expect(screen.getByRole('heading').textContent).toContain(
    'Catch up on all your work.'
  );

  pointer('pointerdown', carousel, down);
  pointer('pointerup', carousel, { ...down, clientX: 200, clientY: 250 });
  expect(screen.getByRole('heading').textContent).toContain(
    'Catch up on all your work.'
  );

  pointer('pointerdown', carousel, down);
  pointer('pointercancel', carousel, down);
  pointer('pointerup', carousel, { ...down, clientX: 200 });
  expect(screen.getByRole('heading').textContent).toContain(
    'Catch up on all your work.'
  );
});

function enableAutoplay() {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  frame.animate = vi.fn(() => ({ cancel() {} }) as Animation);
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [
            {
              target,
              isIntersecting: true,
              intersectionRatio: 1,
            } as IntersectionObserverEntry,
          ],
          this as unknown as IntersectionObserver
        );
      }
      disconnect() {}
    }
  );
}

it('cycles visible slides every eight seconds and wraps to the inbox', () => {
  enableAutoplay();
  mountCarousel();
  vi.advanceTimersByTime(7999);
  expect(openView).toHaveBeenLastCalledWith('Home');
  vi.advanceTimersByTime(1);
  expect(openView).toHaveBeenLastCalledWith('Chat');
  vi.advanceTimersByTime(60000);
  expect(openView).toHaveBeenLastCalledWith('Home');
});

it('pauses on hover, resumes after leaving, and stops when the workspace is used', () => {
  enableAutoplay();
  mountCarousel();
  const carousel = screen.getByRole('region');
  fireEvent.pointerEnter(carousel);
  vi.advanceTimersByTime(16000);
  expect(openView).toHaveBeenLastCalledWith('Home');
  fireEvent.pointerLeave(carousel);
  vi.advanceTimersByTime(8000);
  expect(openView).toHaveBeenLastCalledWith('Chat');
  frame.contentDocument!.dispatchEvent(
    new Event('pointerdown', { bubbles: true })
  );
  openView.mockClear();
  vi.advanceTimersByTime(24000);
  expect(openView).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Pause slideshow' })).toBeNull();
});

it('does not start automatic cycling for reduced motion', () => {
  vi.useFakeTimers();
  mountCarousel();
  vi.advanceTimersByTime(24000);
  expect(openView.mock.calls.map((call) => call[0])).toEqual(['Home']);
  expect(screen.queryByRole('button', { name: 'Pause slideshow' })).toBeNull();
});

it('stops automatic cycling after a manual arrow selection', () => {
  enableAutoplay();
  mountCarousel();
  fireEvent.click(screen.getByRole('button', { name: 'Next highlight' }));
  expect(openView).toHaveBeenLastCalledWith('Chat');
  openView.mockClear();
  vi.advanceTimersByTime(24000);
  expect(openView).not.toHaveBeenCalled();
});

it('selects a dedicated homepage scene instead of forcing legacy app controls', () => {
  frame.contentDocument!.body.innerHTML = '<div data-homepage-demo></div>';
  const selectScene = vi.fn();
  frame.contentWindow!.addEventListener(
    'macro-homepage-demo-view',
    selectScene
  );
  mountCarousel();
  expect(selectScene).toHaveBeenCalledTimes(1);
  expect(selectScene.mock.calls[0][0].detail).toBe('Inbox');
  fireEvent.click(screen.getByRole('button', { name: 'Show Tasks highlight' }));
  expect(selectScene.mock.calls.at(-1)![0].detail).toBe('Tasks');
  expect(openView).not.toHaveBeenCalled();
});

it('keeps the dedicated scene and caption synchronized after an internal rail click', () => {
  frame.contentDocument!.body.insertAdjacentHTML(
    'afterbegin',
    '<div data-homepage-demo></div>'
  );
  const selectScene = vi.fn();
  frame.contentWindow!.addEventListener(
    'macro-homepage-demo-view',
    selectScene
  );
  mountCarousel();
  frame
    .contentDocument!.querySelector<HTMLButtonElement>('[aria-label=Drive]')!
    .click();
  expect(selectScene.mock.calls.at(-1)![0].detail).toBe('Docs');
  expect(
    screen
      .getByRole('button', { name: 'Show Docs highlight' })
      .getAttribute('aria-pressed')
  ).toBe('true');
});
