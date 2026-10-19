import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CrmPipelineScene from './CrmPipelineScene';

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal('fetch', vi.fn());
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it('edits a pipeline deal without overwriting the company record fields', async () => {
  const view = render(() => <CrmPipelineScene />);
  fireEvent.keyDown(
    view.getByRole('button', { name: 'Stage for Northstar Design' }),
    { key: 'Enter' }
  );
  fireEvent.keyDown(
    await screen.findByRole('menuitem', { name: 'Negotiation' }),
    { key: 'Enter' }
  );
  expect(
    view.getByRole('button', { name: 'Stage for Northstar Design' }).textContent
  ).toContain('Negotiation');
  fireEvent.change(
    view.getByRole('textbox', { name: 'Revenue for Northstar Design' }),
    { target: { value: '32000' } }
  );
  fireEvent.click(view.getByRole('button', { name: 'Companies' }));
  const row = view
    .getByRole('button', { name: /Northstar Design/ })
    .closest('tr')!;
  expect(within(row).getByText('Lead')).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'Sales pipeline Team' }));
  expect(
    (
      view.getByRole('textbox', {
        name: 'Revenue for Northstar Design',
      }) as HTMLInputElement
    ).value
  ).toBe('32000');
  expect(
    view.getByRole('button', { name: 'Stage for Northstar Design' }).textContent
  ).toContain('Negotiation');
});

it('opens a linked company record and returns to the same pipeline', () => {
  const view = render(() => <CrmPipelineScene />);
  fireEvent.click(
    view.getByRole('button', { name: /The Meadow meadow.example/ })
  );
  expect(
    (view.getByRole('textbox', { name: 'Company name' }) as HTMLInputElement)
      .value
  ).toBe('The Meadow');
  fireEvent.click(view.getByRole('button', { name: 'Sales pipeline' }));
  expect(view.getByRole('table', { name: 'Sales pipeline' })).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'By stage' }));
  expect(view.queryByRole('table', { name: 'Sales pipeline' })).toBeNull();
  expect(view.getByRole('button', { name: 'The Meadow' })).toBeTruthy();
});
