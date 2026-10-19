import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { homepageFeatureDetails } from '../core/homepage-feature-details';
import { HomepageFeatureDetails } from './HomepageFeatureDetails';

let motionStyle: HTMLStyleElement;
beforeEach(() => {
  // jsdom reports an empty animationName without CSS; Presence expects browser's "none".
  motionStyle = document.createElement('style');
  motionStyle.textContent =
    '.homepage-detail-panel, .homepage-detail-backdrop { animation-name: none; }';
  document.head.append(motionStyle);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  motionStyle.remove();
  vi.restoreAllMocks();
});

it('opens the chosen explanation and returns focus to its trigger on close', async () => {
  render(() => (
    <HomepageFeatureDetails
      group="Email and chat"
      details={homepageFeatureDetails.email}
    />
  ));
  const trigger = screen.getByRole('button', { name: 'Draft from your work' });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog', {
    name: 'Draft from your work',
  });
  expect(dialog.textContent).toContain('Review the draft');
  expect(dialog.textContent).toContain('For example');
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Close feature details' })
    )
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Close feature details' })
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it('dismisses with Escape and opens a different detail without stale content', async () => {
  render(() => (
    <HomepageFeatureDetails
      group="Documents and tasks"
      details={homepageFeatureDetails.documents}
    />
  ));
  fireEvent.click(screen.getByRole('button', { name: 'Write together' }));
  const dialog = await screen.findByRole('dialog', { name: 'Write together' });
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(
    screen.getByRole('button', { name: 'Keep track of changes' })
  );
  const history = await screen.findByRole('dialog', {
    name: 'Keep track of changes',
  });
  expect(history.textContent).toContain('make a new copy');
  expect(history.textContent).not.toContain('same paragraph');
});
