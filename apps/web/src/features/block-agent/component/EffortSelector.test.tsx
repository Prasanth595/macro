/** @vitest-environment jsdom */

import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each([false, true])(
  'previews effort while dragging and applies on release (touch=%s)',
  async (touch) => {
    vi.mocked(isTouchDevice).mockReturnValue(touch);
    const change = vi.fn();
    render(() => <EffortSelector config={config} onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Effort: Low' }));
    const slider = await screen.findByRole('slider', {
      name: 'Reasoning effort',
    });
    fireEvent.input(slider, { target: { value: '1' } });
    expect(slider.getAttribute('aria-valuetext')).toBe('High');
    expect(change).not.toHaveBeenCalled();
    fireEvent.change(slider, { target: { value: '1' } });
    expect(change).toHaveBeenCalledExactlyOnceWith({
      configId: 'effort',
      value: 'high',
      name: 'High',
    });
  }
);
it('hides unsupported effort', () => {
  render(() => <EffortSelector onChange={vi.fn()} />);
  expect(screen.queryByRole('button')).toBeNull();
});
it('does not open while configuration is disabled', () => {
  render(() => <EffortSelector config={config} disabled onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Effort: Low' }));
  expect(screen.queryByRole('slider')).toBeNull();
});
