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
  render(() => <HomepageFeatureDetails title="Email" path="/email" />);
  const opener = screen.getByRole('button', {
    name: 'Learn more about Email',
  });
  fireEvent.click(opener);
  expect(await screen.findByRole('dialog', { name: 'Email' })).toBeTruthy();
  const frame = screen.getByTitle('Email product page');
  expect(frame.getAttribute('src')).toBe('/email?embed=feature&theme=dark');
  fireEvent.load(frame);
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close product page' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(opener));
});

it('handles Escape from the embedded page without stealing a nested dialog’s Escape', async () => {
  render(() => <HomepageFeatureDetails title="CRM" path="/crm" />);
  fireEvent.click(screen.getByRole('button', { name: 'Learn more about CRM' }));
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

it('opens Email and Chat as separate product pages', async () => {
  render(() => (
    <>
      <HomepageFeatureDetails title="Email" path="/email" />
      <HomepageFeatureDetails title="Chat" path="/channels" />
    </>
  ));
  fireEvent.click(
    screen.getByRole('button', { name: 'Learn more about Email' })
  );
  expect(
    (await screen.findByTitle('Email product page')).getAttribute('src')
  ).toBe('/email?embed=feature&theme=dark');
  fireEvent.click(screen.getByRole('button', { name: 'Close product page' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(
    screen.getByRole('button', { name: 'Learn more about Chat' })
  );
  expect(
    (await screen.findByTitle('Chat product page')).getAttribute('src')
  ).toBe('/channels?embed=feature&theme=dark');
});
