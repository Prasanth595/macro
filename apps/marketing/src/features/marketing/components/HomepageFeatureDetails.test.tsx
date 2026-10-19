import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HomepageFeatureDetails } from './HomepageFeatureDetails';

let motionStyle: HTMLStyleElement;
beforeEach(() => {
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

it('opens the actual product page and restores focus when closed', async () => {
  render(() => <HomepageFeatureDetails title="Email and chat" path="/email" />);
  const opener = screen.getByRole('button', {
    name: 'Learn more about email and chat',
  });
  fireEvent.click(opener);
  expect(
    await screen.findByRole('dialog', { name: 'Email and chat' })
  ).toBeTruthy();
  const frame = screen.getByTitle('Email and chat product page');
  expect(frame.getAttribute('src')).toBe('/email?embed=feature&theme=dark');
  expect(
    screen
      .getByRole('link', { name: 'Open email and chat page in a new tab' })
      .getAttribute('href')
  ).toBe('/email');
  fireEvent.load(frame);
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close product page' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(opener));
});

it('handles Escape from the embedded page without stealing a nested dialog’s Escape', async () => {
  render(() => <HomepageFeatureDetails title="CRM" path="/crm" />);
  fireEvent.click(screen.getByRole('button', { name: 'Learn more about crm' }));
  const frame = (await screen.findByTitle(
    'CRM product page'
  )) as HTMLIFrameElement;
  const page = frame.contentDocument!;
  page.open();
  page.write('<!doctype html><html><body></body></html>');
  page.close();
  fireEvent.load(frame);
  page.body.innerHTML = '<div role="dialog">Share company</div>';
  fireEvent.keyDown(page.body, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: 'CRM' })).toBeTruthy();
  page.body.innerHTML = '';
  fireEvent.keyDown(page.body, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
