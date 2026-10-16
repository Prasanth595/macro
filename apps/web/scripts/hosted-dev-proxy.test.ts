import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  createServer as createHttpServer,
  request as httpRequest,
} from 'node:http';
import { get, request } from 'node:https';
import type { AddressInfo, Socket } from 'node:net';
import { createServer, resolveConfig } from 'vite';
import { afterEach, expect, it, vi } from 'vitest';
import { developmentProxyUrl } from '../src/lib/core/constant/developmentProxy';
import { devHttps } from './dev-https';
import { hostedDevProxy } from './hosted-dev-proxy';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('maps dev HTTP and WebSocket URLs while preserving production and OAuth hosts', () => {
  vi.stubEnv('VITE_DEV_PROXY', 'true');
  vi.stubGlobal('location', { origin: 'https://coworker:5122' });
  expect(developmentProxyUrl('https://dev-gateway.macro.com/auth')).toBe(
    'https://coworker:5122/__macro_dev/gateway/auth'
  );
  expect(
    developmentProxyUrl('wss://services-dev.macro.com?token=fixture')
  ).toBe('wss://coworker:5122/__macro_dev/websocket?token=fixture');
  expect(
    developmentProxyUrl('https://sync-service-dev3.macroverse.workers.dev/doc')
  ).toBe('https://coworker:5122/__macro_dev/sync/doc');
  for (const url of [
    'https://gateway.macro.com/auth',
    'https://fusionauth-dev.macro.com/oauth2/logout',
  ]) {
    expect(developmentProxyUrl(url)).toBe(url);
  }
  vi.stubEnv('VITE_DEV_PROXY', 'false');
  expect(developmentProxyUrl('https://dev-gateway.macro.com/auth')).toBe(
    'https://dev-gateway.macro.com/auth'
  );
});

it('maps only the dev static-file bucket without changing signed paths or queries', () => {
  vi.stubEnv('VITE_DEV_PROXY', 'true');
  vi.stubGlobal('location', { origin: 'https://coworker:5122' });
  const path =
    '/image%2Fname%20with%2Bsymbols.png?X-Amz-Credential=test%2Fscope&X-Amz-Signature=abc%2B123&part=1&part=2';
  const url = `https://static-file-storage-dev.s3.us-east-1.amazonaws.com${path}`;
  expect(developmentProxyUrl(url)).toBe(
    `https://coworker:5122/__macro_dev/static-upload${path}`
  );
  for (const origin of [
    'https://static-file-storage-prod.s3.us-east-1.amazonaws.com',
    'https://unrelated.s3.us-east-1.amazonaws.com',
    'https://static-file-storage-dev.s3.us-east-1.amazonaws.com.unrelated.example',
  ]) {
    expect(developmentProxyUrl(`${origin}${path}`)).toBe(`${origin}${path}`);
  }
  vi.stubEnv('VITE_DEV_PROXY', 'false');
  expect(developmentProxyUrl(url)).toBe(url);
});

it.each([false, true])(
  'streams signed uploads without app credentials (100-continue: %s)',
  async (expectContinue) => {
    const uploads: {
      path?: string;
      body: string;
      headers: import('node:http').IncomingHttpHeaders;
    }[] = [];
    const backend = createHttpServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      uploads.push({
        path: req.url,
        body: Buffer.concat(chunks).toString(),
        headers: req.headers,
      });
      res.setHeader('ETag', 'uploaded');
      res.statusCode = 201;
      res.end('stored');
    });
    await new Promise<void>((resolve) =>
      backend.listen(0, '127.0.0.1', resolve)
    );
    const upstream = `http://127.0.0.1:${(backend.address() as AddressInfo).port}`;
    const vite = await createServer({
      configFile: false,
      appType: 'custom',
      logLevel: 'silent',
      plugins: [hostedDevProxy({}, { 'static-upload': upstream })],
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { host: '127.0.0.1', port: 0 },
    });
    try {
      await vite.listen();
      const address = vite.httpServer?.address();
      if (!address || typeof address === 'string')
        throw new Error('No Vite listener');
      const origin = `http://127.0.0.1:${address.port}`;
      const path =
        '/image%2Fname%20with%2Bsymbols.png?X-Amz-Credential=test%2Fscope&X-Amz-Signature=abc%2B123&part=1&part=2';
      const url = `${origin}/__macro_dev/static-upload${path}`;
      const response = await new Promise<{
        status?: number;
        etag?: string;
        body: string;
      }>((resolve, reject) => {
        const upload = httpRequest(
          url,
          {
            method: 'PUT',
            headers: {
              Origin: origin,
              Cookie: 'dev-macro-access-token=fixture',
              Authorization: 'Bearer fixture',
              'Content-Type': 'image/png',
              'Content-Length': Buffer.byteLength('image bytes'),
              'x-amz-checksum-sha256': 'checksum',
              ...(expectContinue ? { Expect: '100-continue' } : {}),
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('error', reject);
            res.on('end', () =>
              resolve({
                status: res.statusCode,
                etag: res.headers.etag,
                body: Buffer.concat(chunks).toString(),
              })
            );
          }
        );
        upload.on('error', reject);
        if (expectContinue) {
          upload.once('continue', () => upload.end('image bytes'));
          upload.flushHeaders();
        } else {
          upload.end('image bytes');
        }
      });
      expect(response.status).toBe(201);
      expect(response.etag).toBe('uploaded');
      expect(response.body).toBe('stored');
      expect(uploads).toHaveLength(1);
      expect(uploads[0]).toMatchObject({
        path,
        body: 'image bytes',
        headers: {
          host: new URL(upstream).host,
          'content-type': 'image/png',
          'x-amz-checksum-sha256': 'checksum',
        },
      });
      expect(uploads[0].headers.cookie).toBeUndefined();
      expect(uploads[0].headers.authorization).toBeUndefined();
      expect(uploads[0].headers.origin).toBeUndefined();
      expect(
        (
          await fetch(url, {
            method: 'PUT',
            headers: { Origin: 'https://unrelated.example' },
          })
        ).status
      ).toBe(403);
      expect(
        (
          await fetch(url, {
            method: 'PUT',
            headers: { 'Sec-Fetch-Site': 'cross-site' },
          })
        ).status
      ).toBe(403);
      const getResponse = await fetch(url);
      expect(getResponse.status).toBe(405);
      expect(getResponse.headers.get('allow')).toBe('PUT');
      expect(uploads).toHaveLength(1);
    } finally {
      await vite.close();
      backend.closeAllConnections();
      await new Promise<void>((resolve) => backend.close(() => resolve()));
    }
  }
);

it('forwards authenticated HTTP and WS over HTTPS, rewrites cookies, and rejects other origins', async () => {
  const sockets = new Set<Socket>();
  const upgrades: {
    cookie: string | undefined;
    origin: string | null;
    path: string | undefined;
  }[] = [];
  let requests = 0;
  const backend = createHttpServer((req, res) => {
    requests++;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Set-Cookie',
      'dev-macro-access-token=fixture; Domain=macro.com; Path=/; Secure; HttpOnly; SameSite=None'
    );
    res.end(
      JSON.stringify({
        path: req.url,
        cookie: req.headers.cookie,
        host: req.headers.host,
        origin: req.headers.origin ?? null,
      })
    );
  });
  backend.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  backend.on('upgrade', (req, socket) => {
    upgrades.push({
      cookie: req.headers.cookie,
      origin: req.headers.origin ?? null,
      path: req.url,
    });
    const accept = createHash('sha1')
      .update(
        `${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`
      )
      .digest('base64');
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
  });
  await new Promise<void>((resolve) => backend.listen(0, '127.0.0.1', resolve));
  const upstream = `http://127.0.0.1:${(backend.address() as AddressInfo).port}`;
  const vite = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    plugins: [devHttps({}), hostedDevProxy({}, { gateway: upstream })],
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { host: '127.0.0.1', port: 0 },
  });
  try {
    vite.middlewares.use((_req, res) => res.end('frontend'));
    await vite.listen();
    const address = vite.httpServer?.address();
    if (!address || typeof address === 'string')
      throw new Error('No Vite listener');
    const origin = `https://localhost:${address.port}`;
    const options = {
      hostname: '127.0.0.1',
      port: address.port,
      servername: 'localhost',
      ca: readFileSync(
        new URL('../../../infra/local/certs/ca.pem', import.meta.url)
      ),
    };
    const cookie = 'dev-macro-access-token=fixture';
    const fetchPage = (path: string, requestOrigin = origin) =>
      new Promise<{
        status: number | undefined;
        body: string;
        cookies: string[];
      }>((resolve, reject) => {
        get(
          {
            ...options,
            path,
            headers: {
              host: new URL(origin).host,
              origin: requestOrigin,
              cookie,
            },
          },
          (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              body += chunk;
            });
            res.on('end', () =>
              resolve({
                status: res.statusCode,
                body,
                cookies: res.headers['set-cookie'] ?? [],
              })
            );
            res.on('error', reject);
          }
        ).on('error', reject);
      });
    const response = await fetchPage(
      '/__macro_dev/gateway/auth/user/me?check=1'
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      path: '/auth/user/me?check=1',
      cookie,
      host: new URL(upstream).host,
      origin: null,
    });
    expect(response.cookies).toEqual([
      `${cookie}; Path=/; Secure; HttpOnly; SameSite=None`,
    ]);
    expect((await fetchPage('/__macro_dev/gatewayish/auth')).body).toBe(
      'frontend'
    );
    const before = requests;
    expect(
      (
        await fetchPage(
          '/__macro_dev/gateway/auth',
          'https://unrelated.example'
        )
      ).status
    ).toBe(403);
    expect(requests).toBe(before);

    const connect = (requestOrigin: string) =>
      new Promise<void>((resolve, reject) => {
        const req = request({
          ...options,
          path: '/__macro_dev/gateway/connection-gateway?check=1',
          headers: {
            host: new URL(origin).host,
            origin: requestOrigin,
            cookie,
            connection: 'Upgrade',
            upgrade: 'websocket',
            'sec-websocket-version': '13',
            'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
          },
        });
        req.setTimeout(3000, () => req.destroy(new Error('WS timeout')));
        req.on('error', reject);
        req.on('response', (res) => {
          res.resume();
          reject(new Error(`WS status ${res.statusCode}`));
        });
        req.on('upgrade', (_res, socket) => {
          socket.destroy();
          resolve();
        });
        req.end();
      });
    await connect(origin);
    expect(upgrades).toEqual([
      { cookie, origin: null, path: '/connection-gateway?check=1' },
    ]);
    await expect(connect('https://unrelated.example')).rejects.toThrow();
    expect(upgrades).toHaveLength(1);
  } finally {
    for (const socket of sockets) socket.destroy();
    await vite.close();
    await new Promise<void>((resolve) => backend.close(() => resolve()));
  }
});

it.each([
  { TAURI_ENV_PLATFORM: 'linux' },
  { MACRO_LOCAL_BACKEND_PROXY: 'https://localhost:8090' },
  { MACRO_DEV_PROXY: 'false' },
])('keeps the existing backend selection for %j', async (env) => {
  const config = await resolveConfig(
    { configFile: false, plugins: [hostedDevProxy(env)] },
    'serve'
  );
  expect(config.server.proxy).toBeUndefined();
  expect(config.define?.['import.meta.env.VITE_DEV_PROXY']).toBeUndefined();
});
