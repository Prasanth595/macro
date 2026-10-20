import { cleanup, fireEvent, render, within } from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CrmFollowupDemo } from './CrmFollowupDemo';

let observe: IntersectionObserverCallback;
let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') && reduced,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: HTMLElement) {
        if (target.classList.contains('crm-followup-demo'))
          observe = this.callback;
      }
      disconnect() {}
      unobserve() {}
    }
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.advanceTimersByTime(100);
  expect(fetch).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function visible(value: boolean) {
  observe(
    [
      {
        isIntersecting: value,
        intersectionRatio: value ? 1 : 0,
      } as IntersectionObserverEntry,
    ],
    {} as IntersectionObserver
  );
}

it('opens the company and reads all six source types before drafting', () => {
  const view = render(() => <CrmFollowupDemo />);
  vi.advanceTimersByTime(20000);
  expect(view.queryByRole('textbox', { name: 'Company name' })).toBeNull();
  visible(true);
  vi.advanceTimersByTime(1200);
  expect(
    view.getByRole<HTMLInputElement>('textbox', { name: 'Company name' }).value
  ).toBe('Parlor Studio');
  vi.advanceTimersByTime(1800);
  expect(
    within(view.getByLabelText('Company emails')).getByText('Thursday demo')
  ).toBeTruthy();
  vi.advanceTimersByTime(1800);
  expect(
    within(view.getByLabelText('Company calls')).getByText('Thursday demo prep')
  ).toBeTruthy();
  vi.advanceTimersByTime(1800);
  expect(
    within(view.getByLabelText('Company files')).getByText('Setup guide')
  ).toBeTruthy();
  vi.advanceTimersByTime(1800);
  expect(
    within(view.getByLabelText('Company tasks')).getByText(
      'Verify folder uploads in production'
    )
  ).toBeTruthy();
  vi.advanceTimersByTime(1800);
  expect(
    view.getByText(/is merged. I’m checking the production release/)
  ).toBeTruthy();
  vi.advanceTimersByTime(1800);
  expect(
    view.getByRole('heading', { name: 'Fix folder uploads' })
  ).toBeTruthy();
  expect(view.getByText('Merged')).toBeTruthy();
  vi.advanceTimersByTime(1800);
  expect(
    view.getByRole<HTMLInputElement>('textbox', { name: 'To' }).value
  ).toBe('Ava Chen <ava@parlorstudio.example>');
  expect(
    view.getByRole('textbox', { name: 'Email body' }).textContent
  ).toContain('checking the production release');
  expect(view.getByText('Next steps')).toBeTruthy();
  expect(
    view.getByRole('button', { name: 'production verification' })
  ).toBeTruthy();
  expect(
    view.queryByText(/update the pipeline from our sales sync/)
  ).toBeNull();
});

it('pauses offscreen and leaves manual company navigation alone', () => {
  const view = render(() => <CrmFollowupDemo />);
  visible(true);
  vi.advanceTimersByTime(1200);
  visible(false);
  vi.advanceTimersByTime(10000);
  expect(view.getByRole('textbox', { name: 'Company name' })).toBeTruthy();
  fireEvent.click(view.getByRole('radio', { name: 'Files' }));
  visible(true);
  vi.advanceTimersByTime(20000);
  expect(view.getByLabelText('Company files')).toBeTruthy();
  expect(view.queryByRole('textbox', { name: 'Email body' })).toBeNull();
});

it('opens every cited source and preserves an edited draft when returning', () => {
  reduced = true;
  const view = render(() => <CrmFollowupDemo />);
  const subject = view.getByRole<HTMLInputElement>('textbox', {
    name: 'Subject',
  });
  fireEvent.input(subject, { target: { value: 'Thursday at 9' } });
  const body = view.getByRole('textbox', { name: 'Email body' });
  body.textContent = 'Hi Ava, I’ll confirm after Teo finishes the check.';
  fireEvent.input(body);
  for (const name of [
    'Thursday demo',
    'prep call',
    'team chat',
    'production verification',
    'setup guide',
  ]) {
    fireEvent.click(view.getByRole('button', { name }));
    expect(view.getByRole('region', { name: 'Customer context' })).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: 'Back to follow-up' }));
    expect(view.getByRole('textbox', { name: 'Subject' })).toBe(subject);
    expect(subject.value).toBe('Thursday at 9');
    expect(view.getByRole('textbox', { name: 'Email body' })).toBe(body);
    expect(body.textContent).toBe(
      'Hi Ava, I’ll confirm after Teo finishes the check.'
    );
  }
  fireEvent.click(view.getByRole('link', { name: 'Fix folder uploads #248' }));
  expect(
    view.getByRole('heading', { name: 'Fix folder uploads' })
  ).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'Back to follow-up' }));
  expect(subject.value).toBe('Thursday at 9');
});

it('opens linked tasks and calls from the real company tabs', () => {
  reduced = true;
  const view = render(() => <CrmFollowupDemo />);
  fireEvent.click(view.getByRole('button', { name: 'Open Parlor Studio' }));
  fireEvent.click(view.getByRole('radio', { name: 'Tasks' }));
  fireEvent.click(
    view.getByRole('button', { name: /Verify folder uploads in production/ })
  );
  expect(
    view.container
      .querySelector('.crm-followup-demo')
      ?.getAttribute('data-source')
  ).toBe('task');
  fireEvent.click(view.getByRole('button', { name: 'Back to follow-up' }));
  fireEvent.click(view.getByRole('button', { name: 'Open Parlor Studio' }));
  fireEvent.click(view.getByRole('radio', { name: 'Calls' }));
  fireEvent.click(
    view.getByRole('button', { name: 'Thursday demo prep Yesterday' })
  );
  expect(
    view.container
      .querySelector('.crm-followup-demo')
      ?.getAttribute('data-source')
  ).toBe('call');
});
