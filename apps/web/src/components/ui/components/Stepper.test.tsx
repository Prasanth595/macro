import { cleanup, render, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Stepper } from './Stepper';

afterEach(cleanup);

describe('Stepper', () => {
  it('finishes an outin step change while detached by an ancestor Suspense', async () => {
    const [step, setStep] = createSignal(0);
    const { container } = render(() => (
      <Stepper step={step()} transition={Stepper.transitions.scale}>
        <Stepper.Step>
          <p>Step one</p>
        </Stepper.Step>
        <Stepper.Step>
          <p>Step two</p>
        </Stepper.Step>
      </Stepper>
    ));
    expect(screen.getByText('Step one')).toBeTruthy();

    // A suspending ancestor pulls its subtree out of the document, where CSS
    // transitions never run and so never emit transitionend.
    const host = container.parentNode as ParentNode;
    container.remove();
    setStep(1);

    await waitFor(() => {
      expect(container.textContent).toContain('Step two');
      expect(container.textContent).not.toContain('Step one');
    });

    host.appendChild(container);
    const slot = screen.getByText('Step two').parentElement as HTMLElement;
    await waitFor(() => {
      expect(slot.className).not.toMatch(/opacity-0|transition-all/);
    });
  });
});

describe('Stepper keepMounted', () => {
  it('retains input DOM and its value across navigation without remounting', async () => {
    const [step, setStep] = createSignal(0);
    const { container } = render(() => (
      <Stepper step={step()} keepMounted>
        <Stepper.Step>
          <input aria-label="First" />
        </Stepper.Step>
        <Stepper.Step>
          <input aria-label="Second" />
        </Stepper.Step>
      </Stepper>
    ));
    const first = screen.getByRole('textbox', {
      name: 'First',
    }) as HTMLInputElement;
    first.value = 'draft';
    setStep(1);
    expect(first.isConnected).toBe(true);
    expect(first.closest('[aria-hidden]')?.getAttribute('aria-hidden')).toBe(
      'true'
    );
    expect((first.parentElement as HTMLElement).inert).toBe(true);
    await waitFor(() => {
      expect((first.parentElement as HTMLElement).style.display).toBe('none');
    });
    setStep(0);
    await waitFor(() => {
      expect((first.parentElement as HTMLElement).style.display).not.toBe(
        'none'
      );
    });
    expect(container.querySelector('input[aria-label="First"]')).toBe(first);
    expect(first.value).toBe('draft');
  });

  it('makes an exiting step inert immediately and ignores its stale exit after reversal', async () => {
    const original = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'getAnimations'
    );
    const completions: Array<() => void> = [];
    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      value: () => [
        { finished: new Promise<void>((resolve) => completions.push(resolve)) },
      ],
    });
    try {
      const [step, setStep] = createSignal(0);
      const { container } = render(() => (
        <Stepper
          step={step()}
          keepMounted
          transition={Stepper.transitions.slide}
        >
          <Stepper.Step>
            <button type="button">First</button>
          </Stepper.Step>
          <Stepper.Step>
            <button type="button">Second</button>
          </Stepper.Step>
        </Stepper>
      ));
      const first = screen.getByText('First').parentElement as HTMLElement;
      const second = screen.getByText('Second').parentElement as HTMLElement;
      setStep(1);
      expect(first.inert).toBe(true);
      expect(first.getAttribute('aria-hidden')).toBe('true');
      expect(first.style.position).toBe('absolute');
      expect(first.style.display).not.toBe('none');
      await waitFor(() => expect(completions.length).toBe(2));
      setStep(0);
      expect(first.inert).toBe(false);
      expect(first.getAttribute('aria-hidden')).toBe('false');
      expect(second.inert).toBe(true);
      completions.splice(0).forEach((resolve) => resolve());
      await waitFor(() => expect(completions.length).toBe(2));
      completions.splice(0).forEach((resolve) => resolve());
      await waitFor(() => expect(second.style.display).toBe('none'));
      expect(first.style.display).not.toBe('none');
      expect(container.querySelector('button')?.textContent).toBe('First');
    } finally {
      if (original)
        Object.defineProperty(Element.prototype, 'getAnimations', original);
      else Reflect.deleteProperty(Element.prototype, 'getAnimations');
    }
  });
  it('skips motion classes and animation frames when reduced motion is enabled', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true }),
    });
    const frames = vi.spyOn(globalThis, 'requestAnimationFrame');
    try {
      const [step, setStep] = createSignal(0);
      render(() => (
        <Stepper
          step={step()}
          keepMounted
          transition={Stepper.transitions.slide}
        >
          <Stepper.Step>
            <button type="button">First</button>
          </Stepper.Step>
          <Stepper.Step>
            <button type="button">Second</button>
          </Stepper.Step>
        </Stepper>
      ));
      const first = screen.getByText('First').parentElement as HTMLElement;
      const second = screen.getByText('Second').parentElement as HTMLElement;
      setStep(1);
      expect(second.className).not.toMatch(/opacity-0|translate-x/);
      expect(frames).not.toHaveBeenCalled();
      await waitFor(() => expect(first.style.display).toBe('none'));
      setStep(0);
      await waitFor(() => expect(second.style.display).toBe('none'));
      expect(first.style.display).not.toBe('none');
      expect(frames).not.toHaveBeenCalled();
    } finally {
      frames.mockRestore();
      if (original) Object.defineProperty(window, 'matchMedia', original);
      else Reflect.deleteProperty(window, 'matchMedia');
    }
  });
});
