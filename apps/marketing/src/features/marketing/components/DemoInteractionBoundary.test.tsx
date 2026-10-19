import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { afterEach, expect, it, vi } from 'vitest';
import {
  DEMO_INTERACTION_EVENT,
  DemoInteractionBoundary,
  DemoInteractionScope,
} from './DemoInteractionBoundary';

afterEach(cleanup);

it('lets preview wheel gestures pass to the page and enables controls only on entry', () => {
  const wheel = vi.fn();
  const use = vi.fn();
  const view = render(() => (
    <DemoInteractionBoundary label="workspace">
      <div onWheel={wheel}>
        <button onClick={use}>Edit item</button>
      </div>
    </DemoInteractionBoundary>
  ));
  const content = view.container.querySelector<HTMLElement>(
    '.demo-interaction-content'
  )!;
  const entry = screen.getByRole('button', { name: /Interact with workspace/ });
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaY: 300,
  });
  entry.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(wheel).not.toHaveBeenCalled();
  const started = vi.fn();
  view.container.addEventListener(DEMO_INTERACTION_EVENT, started);
  fireEvent.click(entry, { detail: 1 });
  expect(content.inert).toBe(false);
  expect(started).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Edit item' }));
  expect(use).toHaveBeenCalledTimes(1);
  fireEvent.pointerDown(document.body);
  expect(content.inert).toBe(true);
});

it('uses one gate for nested demos and restores entry focus with Escape', async () => {
  const view = render(() => (
    <DemoInteractionBoundary>
      <DemoInteractionBoundary>
        <button>Inner action</button>
      </DemoInteractionBoundary>
    </DemoInteractionBoundary>
  ));
  expect(screen.getAllByRole('button', { name: /Interact with/ })).toHaveLength(
    1
  );
  fireEvent.click(screen.getByRole('button', { name: /Interact with/ }), {
    detail: 0,
  });
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Inner action' })
    )
  );
  fireEvent.keyDown(screen.getByRole('button', { name: 'Inner action' }), {
    key: 'Escape',
  });
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Interact with/ })
    )
  );
  view.unmount();
  render(() => (
    <DemoInteractionScope>
      <DemoInteractionBoundary>
        <button>Standalone control</button>
      </DemoInteractionBoundary>
    </DemoInteractionScope>
  ));
  expect(screen.queryByRole('button', { name: /Interact with/ })).toBeNull();
});

it('handles iframe Escape, respects inner menus, and removes frame listeners on unmount', async () => {
  const view = render(() => (
    <DemoInteractionBoundary>
      <iframe title="Sample workspace" />
    </DemoInteractionBoundary>
  ));
  const frame = view.container.querySelector('iframe')!;
  const page = frame.contentDocument!;
  fireEvent.load(frame);
  fireEvent.click(screen.getByRole('button', { name: /Interact with/ }), {
    detail: 1,
  });
  page.body.innerHTML = '<div role="menu">View options</div>';
  fireEvent.keyDown(page.body, { key: 'Escape' });
  expect(screen.queryByRole('button', { name: /Interact with/ })).toBeNull();
  page.body.innerHTML = '';
  fireEvent.keyDown(page.body, { key: 'Escape' });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Interact with/ })).toBeTruthy()
  );
  fireEvent.click(screen.getByRole('button', { name: /Interact with/ }), {
    detail: 1,
  });
  view.unmount();
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  });
  page.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});
