import { createRoot, createSignal } from 'solid-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { idleDebouncedDependent } from './debounce';

let idleCallbacks: Map<number, IdleRequestCallback>;

beforeEach(() => {
  vi.useFakeTimers();
  idleCallbacks = new Map();
  let nextId = 0;
  vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
    const id = ++nextId;
    idleCallbacks.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelIdleCallback', (id: number) => idleCallbacks.delete(id));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const runIdle = () => {
  const callbacks = [...idleCallbacks.values()];
  idleCallbacks.clear();
  for (const callback of callbacks)
    callback({ didTimeout: false, timeRemaining: () => 50 });
};

const setup = () =>
  createRoot((dispose) => {
    const [source, setSource] = createSignal('');
    const value = idleDebouncedDependent(source, 60);
    return { setSource, value, dispose };
  });

it('commits a debounced value only once the browser is idle', () => {
  const { setSource, value, dispose } = setup();

  setSource('a');
  vi.advanceTimersByTime(60);
  expect(value()).toBe('');

  runIdle();
  expect(value()).toBe('a');
  dispose();
});

it('drops a commit still waiting for idle time when the source changes', () => {
  const { setSource, value, dispose } = setup();

  setSource('a');
  vi.advanceTimersByTime(60);
  setSource('ab');
  runIdle();
  expect(value()).toBe('');

  vi.advanceTimersByTime(60);
  runIdle();
  expect(value()).toBe('ab');
  dispose();
});
