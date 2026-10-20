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

let revealCompact: (() => void) | undefined;
beforeEach(() => {
  revealCompact = undefined;
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
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: HTMLElement) {
        if (target.dataset.compact === 'true')
          revealCompact = () =>
            this.callback(
              [
                {
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
  vi.stubGlobal('fetch', vi.fn());
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('switches hero pipelines and keeps each deal’s edits independent', async () => {
  const view = render(() => <CrmPipelineScene hero />);
  fireEvent.click(view.getByRole('button', { name: 'All records' }));
  fireEvent.change(
    view.getByRole('textbox', { name: 'Revenue for Parlor Studio' }),
    {
      target: { value: '22000' },
    }
  );
  fireEvent.click(
    view.getByRole('button', { name: 'Studio partnerships Team' })
  );
  expect(
    view.queryByRole('textbox', { name: 'Revenue for Miller & Rowe' })
  ).toBeNull();
  expect(
    (
      view.getByRole('textbox', {
        name: 'Revenue for Parlor Studio',
      }) as HTMLInputElement
    ).value
  ).toBe('36000');
  fireEvent.click(
    view.getByRole('button', { name: 'Parlor Studio' })
  );
  expect(
    view.getByRole('article', { name: 'Studio partnerships entry' })
  ).toBeTruthy();
  fireEvent.keyDown(view.getByRole('button', { name: 'Change Stage' }), {
    key: 'Enter',
  });
  expect(
    await screen.findByRole('menuitem', { name: 'Customer' })
  ).toBeTruthy();
  expect(screen.queryByRole('menuitem', { name: 'Trial' })).toBeNull();
  fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Customer' }), {
    key: 'Enter',
  });
  fireEvent.click(
    view.getByRole('button', { name: 'Back to Studio partnerships' })
  );
  expect(view.getByRole('table', { name: 'Studio partnerships' })).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'New business Team' }));
  expect(
    (
      view.getByRole('textbox', {
        name: 'Revenue for Parlor Studio',
      }) as HTMLInputElement
    ).value
  ).toBe('22000');
});

it('opens populated hero lists, searches them, and returns from a company', () => {
  const view = render(() => <CrmPipelineScene hero />);
  fireEvent.click(view.getByRole('button', { name: 'Design partners 4' }));
  expect(view.getByRole('heading', { name: 'Design partners' })).toBeTruthy();
  expect(view.getAllByRole('row')).toHaveLength(5);
  expect(view.queryByRole('button', { name: /Bookend Retail/ })).toBeNull();
  fireEvent.input(view.getByRole('searchbox', { name: 'Search records' }), {
    target: { value: 'Parlor' },
  });
  expect(view.getAllByRole('row')).toHaveLength(2);
  fireEvent.click(view.getByRole('button', { name: /Parlor Studio/ }));
  fireEvent.click(
    view.getByRole('button', { name: 'Back to Design partners' })
  );
  expect(view.getByRole('heading', { name: 'Design partners' })).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'Q4 renewals Team' }));
  expect(view.getByRole('region', { name: 'Q4 renewals board' })).toBeTruthy();
  expect(view.getByRole('button', { name: 'Bookend Retail' })).toBeTruthy();
});

it('collapses the hero pipeline section without losing the active pipeline', () => {
  const view = render(() => <CrmPipelineScene hero />);
  fireEvent.click(view.getByRole('button', { name: 'Team expansion Private' }));
  fireEvent.click(view.getByRole('button', { name: 'Pipelines' }));
  expect(view.queryByRole('navigation', { name: 'CRM pipelines' })).toBeNull();
  expect(
    view.getByRole('region', { name: 'Team expansion board' })
  ).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'Pipelines' }));
  expect(
    view
      .getByRole('button', { name: 'Team expansion Private' })
      .getAttribute('aria-current')
  ).toBe('page');
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

it('keeps the landing pipeline to three stages with clickable records and no sidebar', () => {
  const view = render(() => <HomepagePipelineDemo />);
  expect(view.queryByRole('complementary')).toBeNull();
  expect(view.queryByRole('searchbox')).toBeNull();
  expect(view.getByRole('region', { name: 'Demo deals' })).toBeTruthy();
  expect(view.getByRole('region', { name: 'Negotiation deals' })).toBeTruthy();
  expect(view.getByRole('region', { name: 'Customer deals' })).toBeTruthy();
  expect(view.queryByRole('region', { name: 'Lead deals' })).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Parlor Studio' }));
  expect(
    (view.getByRole('textbox', { name: 'Company name' }) as HTMLInputElement)
      .value
  ).toBe('Parlor Studio');
  fireEvent.click(view.getByRole('button', { name: 'Sales pipeline' }));
  expect(
    view.getByRole('region', { name: 'Sales pipeline board' })
  ).toBeTruthy();
});

it('moves deals, opens their context, and stops when a visitor takes over', () => {
  vi.useFakeTimers();
  const view = render(() => <HomepagePipelineDemo />);
  revealCompact?.();
  vi.advanceTimersByTime(3300);
  expect(
    within(view.getByRole('region', { name: 'Negotiation deals' })).getByRole(
      'button',
      { name: 'Parlor Studio' }
    )
  ).toBeTruthy();
  vi.advanceTimersByTime(3300);
  expect(
    within(view.getByRole('region', { name: 'Customer deals' })).getByRole(
      'button',
      { name: 'Bookend Retail' }
    )
  ).toBeTruthy();
  vi.advanceTimersByTime(2000);
  expect(
    (view.getByRole('textbox', { name: 'Company name' }) as HTMLInputElement)
      .value
  ).toBe('Parlor Studio');
  fireEvent.pointerDown(view.getByRole('textbox', { name: 'Company name' }));
  vi.advanceTimersByTime(12000);
  expect(view.getByRole('textbox', { name: 'Company name' })).toBeTruthy();
});

it('shows the email context and returns to the compact board when untouched', () => {
  vi.useFakeTimers();
  const view = render(() => <HomepagePipelineDemo />);
  revealCompact?.();
  vi.advanceTimersByTime(12100);
  expect(
    (
      view.getByRole('radio', {
        name: 'Emails',
      }) as HTMLInputElement
    ).checked
  ).toBe(true);
  vi.advanceTimersByTime(4500);
  expect(
    view.getByRole('region', { name: 'Sales pipeline board' })
  ).toBeTruthy();
});

it('edits the linked pipeline entry from a company record and returns to the same table', async () => {
  const view = render(() => <CrmPipelineScene />);
  fireEvent.click(view.getByRole('button', { name: 'All records' }));
  fireEvent.click(view.getByRole('button', { name: 'Parlor Studio' }));
  const entry = within(
    view.getByRole('article', { name: 'Sales pipeline entry' })
  );
  fireEvent.keyDown(entry.getByRole('button', { name: 'Change Stage' }), {
    key: 'Enter',
  });
  fireEvent.keyDown(
    await screen.findByRole('menuitem', { name: 'Negotiation' }),
    { key: 'Enter' }
  );
  fireEvent.change(entry.getByRole('textbox', { name: 'Pipeline revenue' }), {
    target: { value: '21000' },
  });
  fireEvent.click(entry.getByRole('button', { name: 'Open Sales pipeline' }));
  expect(
    view.getByRole('button', { name: 'Stage for Parlor Studio' }).textContent
  ).toContain('Negotiation');
  expect(
    (
      view.getByRole('textbox', {
        name: 'Revenue for Parlor Studio',
      }) as HTMLInputElement
    ).value
  ).toBe('21000');
});

it('keeps a mobile Back control available from every record tab', () => {
  const view = render(() => <CrmPipelineScene />);
  fireEvent.click(view.getByRole('button', { name: 'Parlor Studio' }));
  fireEvent.click(view.getByRole('radio', { name: 'Team' }));
  fireEvent.click(view.getByRole('button', { name: 'Back to Sales pipeline' }));
  expect(
    view.getByRole('region', { name: 'Sales pipeline board' })
  ).toBeTruthy();
});
