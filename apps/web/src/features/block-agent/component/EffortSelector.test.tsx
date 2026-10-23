/** @vitest-environment jsdom */

import { isTouchDevice } from '@core/mobile/isTouchDevice';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
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
const originalScrollTo = HTMLElement.prototype.scrollTo;
let motionStyles: HTMLStyleElement;
beforeEach(() => {
  motionStyles = document.createElement('style');
  motionStyles.textContent =
    '[role="menu"], [data-corvu-drawer-content], [data-corvu-drawer-overlay] { animation-name: none; transition-duration: 0s; }';
  document.head.append(motionStyles);
  HTMLElement.prototype.scrollTo = vi.fn();
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
  motionStyles.remove();
  HTMLElement.prototype.scrollTo = originalScrollTo;
  vi.unstubAllGlobals();
});
it.each([false, true])(
  'selects a named effort option and closes (touch: %s)',
  async (touch) => {
    vi.mocked(isTouchDevice).mockReturnValue(touch);
    const change = vi.fn();
    const openChange = vi.fn();
    render(() => (
      <EffortSelector
        config={config}
        onChange={change}
        onOpenChange={openChange}
      />
    ));
    const trigger = screen.getByRole('button', { name: 'Effort: Low' });
    if (touch) fireEvent.click(trigger);
    else fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.queryByRole('slider')).toBeNull();
    const high = await screen.findByRole(touch ? 'button' : 'menuitem', {
      name: 'High',
    });
    if (touch) {
      expect(
        screen.getByRole('button', { name: 'Low' }).getAttribute('aria-pressed')
      ).toBe('true');
      expect(high.getAttribute('aria-pressed')).toBe('false');
      fireEvent.click(high);
    } else {
      high.focus();
      fireEvent.keyDown(high, { key: 'Enter' });
    }
    expect(openChange).toHaveBeenLastCalledWith(false);
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

it.each([false, true])(
  'changes speed and effort independently in one menu (touch: %s)',
  async (touch) => {
    vi.mocked(isTouchDevice).mockReturnValue(touch);
    const changeEffort = vi.fn();
    const changeSpeed = vi.fn();
    const [enabled, setEnabled] = createSignal(false);
    render(() => (
      <EffortSelector
        config={config}
        speed={{
          tier: 'ultrafast',
          enabled: enabled(),
          onChange: (next) => {
            setEnabled(next);
            changeSpeed(next);
          },
        }}
        onChange={changeEffort}
      />
    ));
    const trigger = screen.getByRole('button', {
      name: 'Effort: Low · Speed: Standard',
    });
    if (touch) fireEvent.click(trigger);
    else fireEvent.keyDown(trigger, { key: 'Enter' });
    const fast = await screen.findByRole(touch ? 'button' : 'menuitem', {
      name: /Ultrafast/,
    });
    expect(fast.textContent).toContain('6× AI usage');
    if (touch) fireEvent.click(fast);
    else fireEvent.keyDown(fast, { key: 'Enter' });
    expect(changeSpeed).toHaveBeenCalledExactlyOnceWith(true);
    expect(changeEffort).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole(touch ? 'dialog' : 'menu')).toBeNull()
    );

    const updated = screen.getByRole('button', {
      name: 'Effort: Low · Speed: Ultrafast',
    });
    if (touch) fireEvent.click(updated);
    else fireEvent.keyDown(updated, { key: 'Enter' });
    const high = await screen.findByRole(touch ? 'button' : 'menuitem', {
      name: 'High',
    });
    if (touch) fireEvent.click(high);
    else fireEvent.keyDown(high, { key: 'Enter' });
    expect(changeEffort).toHaveBeenCalledExactlyOnceWith({
      configId: 'effort',
      name: 'High',
      value: 'high',
    });
    expect(changeSpeed).toHaveBeenCalledTimes(1);
  }
);

it('keeps speed selectable when the model has no effort choices', async () => {
  vi.mocked(isTouchDevice).mockReturnValue(false);
  const changeSpeed = vi.fn();
  render(() => (
    <EffortSelector
      speed={{ tier: 'ultrafast', enabled: true, onChange: changeSpeed }}
      onChange={vi.fn()}
    />
  ));
  fireEvent.keyDown(screen.getByRole('button', { name: 'Speed: Ultrafast' }), {
    key: 'Enter',
  });
  const standard = await screen.findByRole('menuitem', { name: 'Standard' });
  fireEvent.keyDown(standard, { key: 'Enter' });
  expect(changeSpeed).toHaveBeenCalledExactlyOnceWith(false);
});
it('does not open while configuration is disabled', () => {
  render(() => <EffortSelector config={config} disabled onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Effort: Low' }));
  expect(screen.queryByRole('group', { name: 'Reasoning effort' })).toBeNull();
});

it('returns focus to the composer when the mobile chooser closes', async () => {
  vi.mocked(isTouchDevice).mockReturnValue(true);
  let input!: HTMLTextAreaElement;
  render(() => (
    <>
      <style>{`[data-corvu-drawer-content] { transition-duration: 0s; }`}</style>
      <textarea ref={input} aria-label="Message" />
      <EffortSelector
        config={config}
        onChange={vi.fn()}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          input.focus();
        }}
      />
    </>
  ));
  fireEvent.click(screen.getByRole('button', { name: 'Effort: Low' }));
  const low = await screen.findByRole('button', { name: 'Low' });
  await waitFor(() => expect(document.activeElement).toBe(low));
  fireEvent.keyDown(low, { key: 'Escape' });
  await waitFor(() => expect(document.activeElement).toBe(input));
});

it('dismisses the desktop chooser without changing effort', async () => {
  vi.mocked(isTouchDevice).mockReturnValue(false);
  const change = vi.fn();
  render(() => <EffortSelector config={config} onChange={change} />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Effort: Low' }), {
    key: 'Enter',
  });
  const high = await screen.findByRole('menuitem', { name: 'High' });
  high.focus();
  fireEvent.keyDown(high, { key: 'Escape' });
  expect(
    screen
      .getByRole('button', { name: 'Effort: Low' })
      .getAttribute('aria-expanded')
  ).toBe('false');
  expect(change).not.toHaveBeenCalled();
});

it('uses the latest effort configuration when it changes while open', async () => {
  vi.mocked(isTouchDevice).mockReturnValue(false);
  const change = vi.fn();
  const [current, setCurrent] = createSignal(config);
  render(() => <EffortSelector config={current()} onChange={change} />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Effort: Low' }), {
    key: 'Enter',
  });
  await screen.findByRole('menuitem', { name: 'High' });
  setCurrent({ ...config, id: 'other-effort' });
  const high = screen.getByRole('menuitem', { name: 'High' });
  high.focus();
  fireEvent.keyDown(high, { key: 'Enter' });
  expect(change).toHaveBeenCalledExactlyOnceWith({
    configId: 'other-effort',
    value: 'high',
    name: 'High',
  });
});
