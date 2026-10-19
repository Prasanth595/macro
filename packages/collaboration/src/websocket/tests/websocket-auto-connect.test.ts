import { afterEach, expect, test, vi } from 'vitest';
import type { WebSocketServer } from 'ws';
import type { Websocket, WebsocketData } from '../';
import { JsonSerializer, WebsocketBuilder, WebsocketEvent } from '../';
import { startServer, stopClient, stopServer } from './websocket-test-utils';

let server: WebSocketServer | undefined;
let client: Websocket | undefined;

afterEach(async () => {
  await stopClient(client, 5000);
  await stopServer(server, 5000);
  client = undefined;
  server = undefined;
});

test('waits for explicit session activation, then closes without reconnecting on wake', async () => {
  server = await startServer(0, 5000);
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected TCP server');
  const resolveUrl = vi.fn(() => `ws://localhost:${address.port}`);
  client = new WebsocketBuilder(resolveUrl)
    .withAutoConnect(false)
    .withSerializer(new JsonSerializer<WebsocketData, WebsocketData>())
    .build();

  expect(resolveUrl).not.toHaveBeenCalled();
  expect(client.closedByUser).toBe(true);
  expect(client.send('signed out')).toBe(false);
  client.reconnectIfDisconnected();
  expect(resolveUrl).not.toHaveBeenCalled();

  const opened = Promise.withResolvers<void>();
  client.addEventListener(WebsocketEvent.Open, () => opened.resolve(), {
    once: true,
  });
  client.reconnect();
  await opened.promise;
  expect(resolveUrl).toHaveBeenCalledOnce();
  expect(client.send('signed in')).toBe(true);

  const closed = Promise.withResolvers<void>();
  client.addEventListener(WebsocketEvent.Close, () => closed.resolve(), {
    once: true,
  });
  client.close();
  await closed.promise;
  client.reconnectIfDisconnected();
  expect(resolveUrl).toHaveBeenCalledOnce();
  expect(client.send('signed out again')).toBe(false);

  const reopened = Promise.withResolvers<void>();
  client.addEventListener(WebsocketEvent.Open, () => reopened.resolve(), {
    once: true,
  });
  client.reconnect();
  await reopened.promise;
  expect(resolveUrl).toHaveBeenCalledTimes(2);
  expect(client.send('new session')).toBe(true);
});

test('discards credentials still resolving when a session is replaced', async () => {
  server = await startServer(0, 5000);
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected TCP server');
  const oldUrl = Promise.withResolvers<string>();
  const newUrl = `ws://localhost:${address.port}/?session=new`;
  const resolveUrl = vi
    .fn<() => Promise<string>>()
    .mockReturnValueOnce(oldUrl.promise)
    .mockResolvedValue(newUrl);
  client = new WebsocketBuilder(resolveUrl).withAutoConnect(false).build();
  const opened = Promise.withResolvers<void>();
  const resolved = vi.fn();
  client.addEventListener(WebsocketEvent.UrlResolved, resolved);
  client.addEventListener(WebsocketEvent.Open, () => opened.resolve(), {
    once: true,
  });

  client.reconnect();
  client.close();
  client.reconnect();
  oldUrl.resolve(`ws://localhost:${address.port}/?session=old`);
  await opened.promise;
  expect(resolveUrl).toHaveBeenCalledTimes(2);
  expect(resolved).toHaveBeenCalledOnce();
  expect(client.url).toBe(newUrl);
});
