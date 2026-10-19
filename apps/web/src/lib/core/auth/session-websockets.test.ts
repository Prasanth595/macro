import { createRoot, createSignal } from 'solid-js';
import { afterEach, expect, it, vi } from 'vitest';

const [authenticated, setAuthenticated] = createSignal<boolean | undefined>();
const [userId, setUserId] = createSignal<string | undefined>();
const sockets = vi.hoisted(() => ({
  gateway: { reconnect: vi.fn(), close: vi.fn(), buffer: { read: vi.fn() } },
  storage: { reconnect: vi.fn(), close: vi.fn() },
}));
vi.mock('@core/context/user', () => ({
  useIsAuthenticated: () => authenticated,
  useUserId: () => userId,
}));
vi.mock('@service-connection/websocket', () => ({ ws: sockets.gateway }));
vi.mock('@service-storage/websocket', () => ({ storageWS: sockets.storage }));

import { useSessionWebsockets } from './session-websockets';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  setAuthenticated(undefined);
  setUserId(undefined);
  vi.clearAllMocks();
});

it('starts only for authenticated identities, drains on logout, and replaces account sessions', () => {
  createRoot((cleanup) => {
    dispose = cleanup;
    useSessionWebsockets();
  });
  expect(sockets.gateway.reconnect).not.toHaveBeenCalled();
  setUserId('alice');
  setAuthenticated(false);
  expect(sockets.gateway.reconnect).not.toHaveBeenCalled();

  setAuthenticated(true);
  expect(sockets.gateway.reconnect).toHaveBeenCalledOnce();
  expect(sockets.storage.reconnect).toHaveBeenCalledOnce();
  setUserId('bob');
  expect(sockets.gateway.close).toHaveBeenCalledOnce();
  expect(sockets.storage.close).toHaveBeenCalledOnce();
  expect(sockets.gateway.reconnect).toHaveBeenCalledTimes(2);

  sockets.gateway.buffer.read.mockReturnValueOnce({ type: 'track_entity' });
  setAuthenticated(false);
  expect(sockets.gateway.close).toHaveBeenCalledTimes(2);
  expect(sockets.storage.close).toHaveBeenCalledTimes(2);
  expect(sockets.gateway.buffer.read).toHaveBeenCalledTimes(3);

  setAuthenticated(true);
  expect(sockets.gateway.reconnect).toHaveBeenCalledTimes(3);
  dispose?.();
  dispose = undefined;
  expect(sockets.gateway.close).toHaveBeenCalledTimes(3);
  expect(sockets.storage.close).toHaveBeenCalledTimes(3);
});
