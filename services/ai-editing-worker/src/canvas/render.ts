import puppeteer, {
  type Browser,
  type BrowserContext,
  type BrowserWorker,
  type Page,
} from '@cloudflare/puppeteer';
import { BrowserWebSocketTransport } from '@cloudflare/puppeteer/internal/common/BrowserWebSocketTransport.js';
import {
  type Bounds,
  type GraphicsDocument,
  type TextFitRequest,
  type TextFitResult,
  worldBounds,
} from '@macro-inc/graphics';
import { Telemetry } from '@macro-inc/observability';
import PQueue from 'p-queue';
import { z } from 'zod';
import { overlaps } from './dependencies';

declare global {
  interface Window {
    renderCanvasSnapshot: (snapshot: {
      document: GraphicsDocument;
      crop: Bounds;
      scale: number;
      revision: string;
    }) => Promise<void>;
    measureCanvasSnapshot: (snapshot: {
      document: GraphicsDocument;
      requests: TextFitRequest[];
    }) => Promise<TextFitResult>;
    readCanvasTextLayout: () => {
      id: string;
      bounds: Bounds;
      overflow: boolean;
    }[];
  }
}

const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
export const canvasRenderOptions = z
  .object({
    itemIds: z.array(z.string().max(200)).min(1).max(100).optional(),
    crop: z
      .object({
        x: coordinate,
        y: coordinate,
        width: z.number().positive().max(1_000_000),
        height: z.number().positive().max(1_000_000),
      })
      .strict()
      .optional(),
  })
  .strict();
export type CanvasRenderOptions = z.infer<typeof canvasRenderOptions>;
export type CanvasSnapshot = {
  document: GraphicsDocument;
  clock: Record<string, number>;
};
export type CanvasRender = {
  revision: string;
  clock: Record<string, number>;
  crop: Bounds;
  width: number;
  height: number;
  objects: { id: string; bounds: Bounds }[];
  unavailable: { id: string; reason: string }[];
  textLayout: { id: string; bounds: Bounds; overflow: boolean }[];
  modelMedia: { type: 'image'; mediaType: 'image/png'; data: string }[];
};
export type CanvasMeasurer = (
  snapshot: CanvasSnapshot,
  requests: TextFitRequest[],
  signal?: AbortSignal
) => Promise<TextFitResult>;
export type CanvasRenderer = (
  snapshot: CanvasSnapshot,
  options?: CanvasRenderOptions,
  signal?: AbortSignal
) => Promise<CanvasRender>;
export type CanvasBrowserConfig = {
  BROWSER?: BrowserWorker;
  CANVAS_BROWSER_URL: string;
  CANVAS_RENDER_URL: string;
};

/** Late startup completion must release its browser/socket even after cancellation. */
async function startResource<T>(
  pending: Promise<T>,
  signal: AbortSignal,
  release: (resource: T) => void
): Promise<T> {
  void pending.then(
    (resource) => {
      if (signal.aborted) release(resource);
    },
    () => {}
  );
  signal.throwIfAborted();
  let abort = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([pending, cancelled]);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

async function withRenderPage<T>(
  config: CanvasBrowserConfig,
  width: number,
  height: number,
  signal: AbortSignal | undefined,
  run: (page: Page) => Promise<T>
): Promise<T> {
  const startupSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(25_000)])
    : AbortSignal.timeout(25_000);
  const renderUrl = new URL(config.CANVAS_RENDER_URL);
  const origin = renderUrl.origin;
  let browserWSEndpoint: string | undefined;
  if (config.CANVAS_BROWSER_URL) {
    const endpoint = new URL(config.CANVAS_BROWSER_URL);
    const version = z.object({ webSocketDebuggerUrl: z.string().url() }).parse(
      await (
        await fetch(new URL('/json/version', endpoint), {
          signal: startupSignal,
        })
      ).json()
    );
    const socket = new URL(version.webSocketDebuggerUrl);
    socket.host = endpoint.host;
    socket.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    browserWSEndpoint = socket.toString();
  }
  const transport = browserWSEndpoint
    ? await startResource(
        BrowserWebSocketTransport.create(browserWSEndpoint),
        startupSignal,
        (value) => value.close()
      )
    : undefined;
  let browser: Browser | undefined;
  try {
    const pending = transport
      ? puppeteer.connect({
          transport,
          ignoreHTTPSErrors: true,
          protocolTimeout: 20_000,
        })
      : config.BROWSER
        ? puppeteer.launch(config.BROWSER)
        : undefined;
    if (pending)
      browser = await startResource(pending, startupSignal, (value) => {
        if (config.CANVAS_BROWSER_URL) value.disconnect();
        else void value.close();
      });
  } catch (error) {
    transport?.close();
    throw error;
  }
  if (!browser) throw new Error('Canvas browser rendering is not configured.');
  let context: BrowserContext | undefined;
  const abort = () => {
    void context?.close().catch(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    signal?.throwIfAborted();
    context = await browser.createBrowserContext();
    signal?.throwIfAborted();
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = new URL(request.url());
      // Only the application's render bundle/fonts may load. No API, referenced
      // assets, arbitrary URLs, live sync or navigation from serialized text.
      const allowed =
        url.origin === origin &&
        (url.pathname === renderUrl.pathname ||
          ['script', 'stylesheet', 'font'].includes(request.resourceType()));
      void (allowed ? request.continue() : request.abort()).catch(() => {});
    });
    await page.goto(renderUrl.toString(), {
      waitUntil: 'networkidle0',
      timeout: 25_000,
    });
    await page.waitForFunction(
      'typeof window.renderCanvasSnapshot === "function" && typeof window.measureCanvasSnapshot === "function"'
    );
    signal?.throwIfAborted();
    return await run(page);
  } finally {
    signal?.removeEventListener('abort', abort);
    await context?.close().catch(() => {});
    if (config.CANVAS_BROWSER_URL) await browser.disconnect();
    else await browser.close();
  }
}

/** Trusted configuration selects the single render surface. Models never supply URLs. */
export function createCanvasRenderer(
  config: CanvasBrowserConfig
): CanvasRenderer & { measure: CanvasMeasurer } {
  const browsers = new PQueue({ concurrency: 2 });
  const render: CanvasRenderer = async (snapshot, options = {}, signal) =>
    Telemetry.span('canvas.ai.render', async (span) => {
      signal?.throwIfAborted();
      const serialized = JSON.stringify(snapshot);
      if (serialized.length > 2_000_000)
        throw new Error('Canvas snapshot exceeds the 2 MB render limit.');
      const bytes = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(serialized)
      );
      const revision = Array.from(new Uint8Array(bytes), (value) =>
        value.toString(16).padStart(2, '0')
      ).join('');
      const { document } = snapshot;
      const shapes = Object.values(document.items).filter(
        (item) => item.type !== 'surface' && item.type !== 'group'
      );
      const selected = options.itemIds
        ? options.itemIds.map((id) => {
            if (!document.items[id] || document.items[id].type === 'surface')
              throw new Error(`Canvas item ${id} does not exist.`);
            return worldBounds(document, id);
          })
        : shapes.map((item) => worldBounds(document, item.id));
      const union = selected.length
        ? {
            x: Math.min(...selected.map((b) => b.x)),
            y: Math.min(...selected.map((b) => b.y)),
            width:
              Math.max(...selected.map((b) => b.x + b.width)) -
              Math.min(...selected.map((b) => b.x)),
            height:
              Math.max(...selected.map((b) => b.y + b.height)) -
              Math.min(...selected.map((b) => b.y)),
          }
        : { x: 0, y: 0, width: 640, height: 480 };
      const crop = options.crop ?? {
        x: union.x - 32,
        y: union.y - 32,
        width: Math.max(64, union.width + 64),
        height: Math.max(64, union.height + 64),
      };
      const scale = Math.min(2, 1600 / crop.width, 1200 / crop.height);
      if (scale < 0.01)
        throw new Error(
          'Canvas crop exceeds the renderer zoom limit. Request a smaller crop or selection.'
        );
      const width = Math.max(1, Math.ceil(crop.width * scale));
      const height = Math.max(1, Math.ceil(crop.height * scale));
      const objects = shapes
        .map((item) => ({
          id: item.id,
          bounds: worldBounds(document, item.id),
        }))
        .filter((item) => overlaps(item.bounds, crop));
      const unavailable = shapes
        .filter(
          (item) =>
            ['image', 'video', 'document'].includes(item.type) &&
            objects.some((object) => object.id === item.id)
        )
        .map((item) => ({
          id: item.id,
          reason:
            'Embedded content is unavailable to this scoped render; no referenced resource or external URL was fetched.',
        }));
      return browsers.add(
        () =>
          withRenderPage(config, width, height, signal, async (page) => {
            await page.evaluate(
              async (payload) => {
                await window.renderCanvasSnapshot(payload);
                await window.document.fonts.ready;
              },
              { document, crop, scale, revision }
            );
            signal?.throwIfAborted();
            const data = await page.screenshot({
              type: 'png',
              encoding: 'base64',
            });
            const textLayout = await page.evaluate(() => {
              return window.readCanvasTextLayout();
            });
            if (data.length > 4_000_000)
              throw new Error(
                'Canvas image exceeds the 3 MB image limit. Request a smaller crop.'
              );
            span.setAttr('canvas.render.objects', objects.length);
            span.setAttr('canvas.render.bytes', data.length);
            const imageHash = await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(data)
            );
            span.setAttr(
              'canvas.render.image_sha256',
              Array.from(new Uint8Array(imageHash), (value) =>
                value.toString(16).padStart(2, '0')
              ).join('')
            );
            span.setAttr('canvas.render.native_images', 1);
            return {
              revision,
              clock: snapshot.clock,
              crop,
              width,
              height,
              objects,
              unavailable,
              textLayout: textLayout.filter((item) =>
                objects.some((object) => object.id === item.id)
              ),
              modelMedia: [{ type: 'image', mediaType: 'image/png', data }],
            };
          }),
        { signal }
      );
    });
  const measure: CanvasMeasurer = async (snapshot, requests, signal) =>
    Telemetry.span('canvas.ai.measure_text', async (span) => {
      if (!requests.length) return { document: snapshot.document, effects: [] };
      if (requests.length > 100 || JSON.stringify(snapshot).length > 2_000_000)
        throw new Error(
          'Canvas text measurement exceeds its bounded batch size.'
        );
      span.setAttr('canvas.text.targets', requests.length);
      return browsers.add(
        () =>
          withRenderPage(config, 1024, 768, signal, async (page) =>
            page.evaluate(
              async (payload) => {
                return await window.measureCanvasSnapshot(payload);
              },
              { document: snapshot.document, requests }
            )
          ),
        { signal }
      );
    });
  return Object.assign(render, { measure });
}
