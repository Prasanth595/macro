import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { afterEach, expect, it, vi } from 'vitest';
import { NumberUnitInput } from './NumberUnitInput';

afterEach(cleanup);

it('places the number and accessible unit in one standard frame without requiring controls', async () => {
  const user = userEvent.setup();
  render(() => (
    <NumberUnitInput defaultValue={30} minValue={0} maxValue={60}>
      <NumberUnitInput.Frame>
        <NumberUnitInput.Input aria-label="Duration" />
        <NumberUnitInput.Unit>min</NumberUnitInput.Unit>
      </NumberUnitInput.Frame>
    </NumberUnitInput>
  ));
  const input = screen.getByRole('spinbutton', {
    name: 'Duration',
  }) as HTMLInputElement;
  const unit = screen.getByText('min');
  const frame = input.closest('[data-number-unit-input]');
  expect(frame?.contains(unit)).toBe(true);
  expect(frame?.getAttribute('data-slot')).toBe('input-group');
  expect(frame?.getAttribute('data-size')).toBe('lg');
  expect(input.classList.contains('text-left')).toBe(true);
  expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(unit.id);
  expect(screen.queryByRole('button', { name: 'Increase value' })).toBeNull();
  await user.click(unit);
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe('30');
});

it('uses Kobalte stepping and bounds with composable controls without submitting the form', async () => {
  const user = userEvent.setup();
  const [value, setValue] = createSignal('2');
  const [disabled, setDisabled] = createSignal(false);
  const submit = vi.fn();
  render(() => (
    <form onSubmit={submit}>
      <NumberUnitInput
        value={value()}
        onChange={setValue}
        format={false}
        minValue={1}
        maxValue={3}
        disabled={disabled()}
      >
        <NumberUnitInput.Controls align="inline-start">
          <NumberUnitInput.DecrementTrigger />
        </NumberUnitInput.Controls>
        <NumberUnitInput.Frame>
          <NumberUnitInput.Input aria-label="Amount" />
          <NumberUnitInput.Unit>days</NumberUnitInput.Unit>
        </NumberUnitInput.Frame>
        <NumberUnitInput.Controls align="inline-end">
          <NumberUnitInput.IncrementTrigger />
        </NumberUnitInput.Controls>
      </NumberUnitInput>
    </form>
  ));
  const input = screen.getByRole('spinbutton', { name: 'Amount' });
  const decrement = screen.getByRole('button', {
    name: 'Decrease value',
  }) as HTMLButtonElement;
  const increment = screen.getByRole('button', {
    name: 'Increase value',
  }) as HTMLButtonElement;
  const frame = input.closest('[data-number-unit-input]');
  expect(frame?.contains(decrement)).toBe(false);
  expect(frame?.contains(increment)).toBe(false);
  expect(decrement.classList.contains('size-8')).toBe(true);
  expect(increment.classList.contains('size-8')).toBe(true);
  await user.click(decrement);
  expect(value()).toBe('1');
  expect(document.activeElement).toBe(input);
  expect(decrement.disabled).toBe(true);
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  expect(value()).toBe('2');
  await user.click(increment);
  expect(value()).toBe('3');
  expect(increment.disabled).toBe(true);
  expect(submit).not.toHaveBeenCalled();
  setDisabled(true);
  expect(decrement.disabled).toBe(true);
  expect((input as HTMLInputElement).disabled).toBe(true);
  await user.click(decrement);
  expect(value()).toBe('3');
});

it('keeps read-only inputs focusable but prevents button and keyboard changes', async () => {
  const user = userEvent.setup();
  const changes = vi.fn();
  render(() => (
    <NumberUnitInput value={2} onChange={changes} readOnly>
      <NumberUnitInput.DecrementTrigger />
      <NumberUnitInput.Frame>
        <NumberUnitInput.Input aria-label="Read-only amount" />
        <NumberUnitInput.Unit>days</NumberUnitInput.Unit>
      </NumberUnitInput.Frame>
      <NumberUnitInput.IncrementTrigger />
    </NumberUnitInput>
  ));
  const input = screen.getByRole('spinbutton', {
    name: 'Read-only amount',
  }) as HTMLInputElement;
  input.focus();
  expect(document.activeElement).toBe(input);
  expect(input.readOnly).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Increase value' }));
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  expect(changes).not.toHaveBeenCalled();
});
