import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

it('replaces the caching worker without waiting for tabs to close, clears only its caches, and unregisters', async () => {
  const handlers: Record<
    string,
    (event: { waitUntil: (work: Promise<unknown>) => void }) => void
  > = {};
  const cacheNames = [
    'macro-shell-v1',
    'macro-assets-v1',
    'macro-shell-v0',
    'macro-assets-v0',
    'macro-unrelated',
    'other-app-cache',
  ];
  const skipWaiting = vi.fn(async () => {});
  const unregister = vi.fn(async () => {
    expect(cacheNames).toEqual(['macro-unrelated', 'other-app-cache']);
    return true;
  });
  const deleteCache = vi.fn(async (name: string) => {
    cacheNames.splice(cacheNames.indexOf(name), 1);
    return true;
  });

  runInNewContext(
    readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'),
    {
      URL,
      self: {
        registration: { scope: 'https://macro.test/app/', unregister },
        addEventListener: (type: string, handler: (typeof handlers)[string]) => {
          handlers[type] = handler;
        },
        skipWaiting,
      },
      caches: {
        keys: async () => [...cacheNames],
        delete: deleteCache,
      },
    }
  );

  // No fetch or message handler can serve an old shell or reload an open tab.
  expect(Object.keys(handlers)).toEqual(['install', 'activate']);
  const installWork = vi.fn();
  handlers.install({ waitUntil: installWork });
  await installWork.mock.calls[0][0];
  expect(skipWaiting).toHaveBeenCalledOnce();
  expect(unregister).not.toHaveBeenCalled();

  const activateWork = vi.fn();
  handlers.activate({ waitUntil: activateWork });
  await activateWork.mock.calls[0][0];
  expect(deleteCache.mock.calls).toEqual([
    ['macro-shell-v1'],
    ['macro-assets-v1'],
    ['macro-shell-v0'],
    ['macro-assets-v0'],
  ]);
  expect(unregister).toHaveBeenCalledOnce();
});
