import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProductFeatureDetails } from './ProductFeatureDetails';
import * as productPreview from './productPagePreview';

let motionStyle: HTMLStyleElement;
beforeEach(() => {
  // JSDOM returns an empty animation-name; Kobalte expects the browser's 'none'.
  motionStyle = document.createElement('style');
  motionStyle.textContent =
    '.product-detail-panel, .product-detail-backdrop { animation-name: none; }';
  document.head.append(motionStyle);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

it('uses Back inside a homepage preview and preserves the underlying page', async () => {
  vi.spyOn(productPreview, 'isEmbeddedProductPage').mockReturnValue(true);
  render(() => (
    <>
      <input aria-label="Demo draft" value="My edited brief" />
      <ProductFeatureDetails
        section="Write with your agent"
        details={[
          {
            title: 'Edit together',
            summary: 'Work in the same shared document.',
            text: 'Changes merge as your team writes.',
          },
        ]}
      />
    </>
  ));
  const draft = screen.getByRole('textbox', { name: 'Demo draft' });
  const card = screen.getByRole('button', { name: 'Edit together' });
  fireEvent.click(card);
  expect(
    await screen.findByRole('dialog', { name: 'Edit together' })
  ).toBeTruthy();
  const back = screen.getByRole('button', { name: 'Back to product page' });
  await waitFor(() => expect(document.activeElement).toBe(back));
  expect(
    screen.queryByRole('button', { name: 'Close feature details' })
  ).toBeNull();
  fireEvent.click(back);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(card));
  expect(screen.getByRole('textbox', { name: 'Demo draft' })).toBe(draft);
  expect(draft.getAttribute('value')).toBe('My edited brief');
});
afterEach(() => {
  cleanup();
  motionStyle.remove();
  vi.restoreAllMocks();
});

it('shows the selected detail in a drawer and restores its trigger on close', async () => {
  render(() => (
    <ProductFeatureDetails
      section="Move through your inbox"
      details={[
        {
          title: 'Navigate with J and K',
          summary: 'Navigate without the mouse.',
          text: 'Move between conversations.',
        },
        {
          title: 'Mark it done',
          summary: 'Clear completed conversations.',
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
