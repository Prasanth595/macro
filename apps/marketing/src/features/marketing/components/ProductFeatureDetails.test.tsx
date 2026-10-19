import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProductFeatureDetails } from './ProductFeatureDetails';

let motionStyle: HTMLStyleElement;
beforeEach(() => {
  // JSDOM returns an empty animation-name; Kobalte expects the browser's 'none'.
  motionStyle = document.createElement('style');
  motionStyle.textContent =
    '.product-detail-modal, .product-detail-backdrop { animation-name: none; }';
  document.head.append(motionStyle);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  motionStyle.remove();
  vi.restoreAllMocks();
});

it('shows the selected detail in a modal and restores its trigger on close', async () => {
  render(() => (
    <ProductFeatureDetails
      section="Move through your inbox"
      details={[
        { title: 'Navigate with J and K', text: 'Move between conversations.' },
        {
          title: 'Mark it done',
          text: 'Press E to mark the conversation done.',
        },
      ]}
    />
  ));
  const navigate = screen.getByRole('button', {
    name: 'Navigate with J and K',
  });
  const done = screen.getByRole('button', { name: 'Mark it done' });
  fireEvent.click(navigate);
  expect(
    await screen.findByRole('dialog', { name: 'Navigate with J and K' })
  ).toBeTruthy();
  expect(screen.getByText('Move between conversations.')).toBeTruthy();
  const close = screen.getByRole('button', { name: 'Close feature details' });
  await waitFor(() => expect(document.activeElement).toBe(close));
  fireEvent.click(close);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(navigate));

  fireEvent.click(done);
  const dialog = await screen.findByRole('dialog', { name: 'Mark it done' });
  expect(
    screen.getByText('Press E to mark the conversation done.')
  ).toBeTruthy();
  expect(screen.queryByText('Move between conversations.')).toBeNull();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(done));
});
