/** @vitest-environment jsdom */

import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, expect, it, vi } from 'vitest';
import type { SelectSessionConfigOption } from '../state/session-config';
import { EffortSelector } from './EffortSelector';

vi.mock('@core/mobile/isTouchDevice', () => ({
  isTouchDevice: vi.fn(() => false),
}));

const config: SelectSessionConfigOption = {
  id: 'effort',
  name: 'Effort',
  category: 'thought_level',
  description: null,
  type: 'select',
  currentValue: 'low',
  options: [
    { name: 'Low', value: 'low', group: null, description: null },
    { name: 'High', value: 'high', group: null, description: null },
  ],
};
afterEach(cleanup);
it.each([false, true])(
  'selects named effort and closes choices (touch=%s)',
  async (touch) => {
    vi.mocked(isTouchDevice).mockReturnValue(touch);
    const change = vi.fn();
    render(() => <EffortSelector config={config} onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Effort: Low' }));
    const high = await screen.findByRole('button', { name: 'High' });
    expect(
      screen.getByRole('button', { name: 'Low' }).getAttribute('aria-pressed')
    ).toBe('true');
    fireEvent.click(high);
    expect(change).toHaveBeenCalledExactlyOnceWith({
      configId: 'effort',
      value: 'high',
      name: 'High',
    });
    expect(
      screen
        .getByRole('button', { name: 'Effort: Low' })
        .getAttribute('aria-expanded')
    ).toBe('false');
  }
);
it('hides unsupported effort', () => {
  render(() => <EffortSelector onChange={vi.fn()} />);
  expect(screen.queryByRole('button')).toBeNull();
});
it('does not open while configuration is disabled', () => {
  render(() => <EffortSelector config={config} disabled onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Effort: Low' }));
  expect(screen.queryByRole('button', { name: 'High' })).toBeNull();
});
