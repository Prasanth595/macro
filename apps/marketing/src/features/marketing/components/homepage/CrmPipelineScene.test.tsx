import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HomepagePipelineDemo from '../HomepagePipelineDemo';
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
  expect(
    view.getByRole('region', { name: 'Sales pipeline board' })
  ).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'All records' }));
  fireEvent.keyDown(
    view.getByRole('button', { name: 'Stage for Miller & Rowe' }),
    {
      key: 'Enter',
    }
  );
  fireEvent.keyDown(
    await screen.findByRole('menuitem', { name: 'Negotiation' }),
    { key: 'Enter' }
  );
  expect(
    view.getByRole('button', { name: 'Stage for Miller & Rowe' }).textContent
  ).toContain('Negotiation');
  fireEvent.change(
    view.getByRole('textbox', { name: 'Revenue for Miller & Rowe' }),
    {
      target: { value: '32000' },
    }
  );
  fireEvent.click(view.getByRole('button', { name: 'Companies' }));
  const row = view
    .getByRole('button', { name: /Miller & Rowe/ })
    .closest('tr')!;
  expect(within(row).getByText('Lead')).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'Sales pipeline Team' }));
  expect(
    (
      view.getByRole('textbox', {
        name: 'Revenue for Miller & Rowe',
      }) as HTMLInputElement
    ).value
  ).toBe('32000');
  expect(
    view.getByRole('button', { name: 'Stage for Miller & Rowe' }).textContent
  ).toContain('Negotiation');
});

it('opens a linked company record and returns to the same pipeline', () => {
  const view = render(() => <CrmPipelineScene />);
  expect(
    view.getByRole('region', { name: 'Sales pipeline board' })
  ).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'All records' }));
  fireEvent.click(view.getByRole('button', { name: /^Parlor Studio$/ }));
  expect(
    (view.getByRole('textbox', { name: 'Company name' }) as HTMLInputElement)
      .value
  ).toBe('Parlor Studio');
  fireEvent.click(view.getByRole('button', { name: 'Sales pipeline' }));
  expect(view.getByRole('table', { name: 'Sales pipeline' })).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'By stage' }));
  expect(view.queryByRole('table', { name: 'Sales pipeline' })).toBeNull();
  expect(view.getByRole('button', { name: 'Parlor Studio' })).toBeTruthy();
});

it('keeps empty stages available when moving a deal on the board', () => {
  const view = render(() => <CrmPipelineScene />);
  const lane = view.getByRole('region', { name: 'Churned deals' });
  fireEvent.drop(lane, { dataTransfer: { getData: () => 'northstar' } });
  expect(
    within(lane).getByRole('button', { name: 'Miller & Rowe' })
  ).toBeTruthy();
  expect(view.getByRole('region', { name: 'Lead deals' })).toBeTruthy();
  expect(view.getByRole('region', { name: 'No stage deals' })).toBeTruthy();
});

it('moves a fictional account through the native-style card menu', async () => {
  const view = render(() => <CrmPipelineScene />);
  expect(view.queryByText('Figma')).toBeNull();
  expect(view.queryByText('Northwind')).toBeNull();
  fireEvent.keyDown(view.getByRole('button', { name: 'Move Miller & Rowe' }), {
    key: 'Enter',
  });
  fireEvent.keyDown(await screen.findByRole('menuitem', { name: 'Trial' }), {
    key: 'Enter',
  });
  expect(
    within(view.getByRole('region', { name: 'Trial deals' })).getByRole(
      'button',
      { name: 'Miller & Rowe' }
    )
  ).toBeTruthy();
});

it('lets landing-page visitors search a live pipeline without playback controls', () => {
  const view = render(() => <HomepagePipelineDemo />);
  expect(view.queryByRole('button', { name: /Replay|Pause/ })).toBeNull();
  fireEvent.input(view.getByRole('searchbox', { name: 'Search pipeline' }), {
    target: { value: 'Juniper' },
  });
  expect(view.getByRole('button', { name: 'Juniper Dental' })).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Miller & Rowe' })).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Contacts' }));
  expect(view.getByText('alex@parlorstudio.example')).toBeTruthy();
  expect(view.queryByText('alex@coparse.com')).toBeNull();
});
