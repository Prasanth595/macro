import { fireAndForget } from '@core/util/fireAndForget';
import { throttle } from '@solid-primitives/scheduled';

/** One request in flight; queued work always reads the newest eligible snapshot. */
export function createInferenceQueue<T>(options: {
  read: () => T | undefined;
  key: (input: T) => string;
  run: (input: T) => Promise<void>;
}) {
  let running = false;
  let queued = false;
  let disposed = false;
  let lastKey: string | undefined;

  const run = async () => {
    if (disposed) return;
    const input = options.read();
    if (!input || options.key(input) === lastKey) return;
    if (running) {
      queued = true;
      return;
    }
    running = true;
    queued = false;
    lastKey = options.key(input);
    try {
      await options.run(input);
    } finally {
      running = false;
      if (queued && !disposed) {
        queued = false;
        fireAndForget(run(), 'universal-input');
      }
    }
  };
  const schedule = throttle(() => fireAndForget(run(), 'universal-input'), 200);
  const clear = () => {
    queued = false;
    lastKey = undefined;
    schedule.clear();
  };
  return {
    enqueue(immediate = false) {
      if (immediate) {
        schedule.clear();
        fireAndForget(run(), 'universal-input');
      } else schedule();
    },
    clear,
    dispose() {
      disposed = true;
      clear();
    },
  };
}
