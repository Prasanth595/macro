import { afterEach, expect, it, vi } from 'vitest';
import { RESET_UNIVERSAL_INPUT_EVENT } from '../../universal-input/core/editor-events';
import { resetHomeComposer } from './focus-composer';

const mocks = vi.hoisted(() => ({
  target: undefined as HTMLElement | null | undefined,
}));
vi.mock('@core/directive/focusInput', () => ({
  triggerFocusInput: (read: () => HTMLElement | null | undefined) => {
    mocks.target = read();
  },
}));
afterEach(() => {
  document.body.innerHTML = '';
  mocks.target = undefined;
});
it('focuses the usual composer in the selected split without clearing its draft', () => {
  document.body.innerHTML =
    '<div data-split-id="other"><div data-universal-input contenteditable="true">Other draft</div></div><div data-split-id="selected"><div data-home-composer-align="agents"><div contenteditable="true">My usual draft</div></div></div>';
  const selected = document.querySelector<HTMLElement>(
    '[data-home-composer-align] [contenteditable]'
  )!;
  const reset = vi.fn();
  selected.addEventListener(RESET_UNIVERSAL_INPUT_EVENT, reset);
  resetHomeComposer('selected');
  expect(mocks.target).toBe(selected);
  expect(reset).not.toHaveBeenCalled();
  expect(selected.textContent).toBe('My usual draft');
});
it('clears the universal composer only in the selected split', () => {
  document.body.innerHTML =
    '<div data-split-id="other"><div data-universal-input contenteditable="true"></div></div><div data-split-id="selected"><div data-universal-input contenteditable="true"></div></div>';
  const inputs = document.querySelectorAll('[data-universal-input]');
  const otherReset = vi.fn();
  const selectedReset = vi.fn();
  inputs[0].addEventListener(RESET_UNIVERSAL_INPUT_EVENT, otherReset);
  inputs[1].addEventListener(RESET_UNIVERSAL_INPUT_EVENT, selectedReset);
  resetHomeComposer('selected');
  expect(mocks.target).toBe(inputs[1]);
  expect(selectedReset).toHaveBeenCalledOnce();
  expect(otherReset).not.toHaveBeenCalled();
});
