/**
 * The channel-open budget.
 *
 * Opening a channel is the app's most frequent navigation, and the work it
 * does grows by accident: a query added to a component every row or composer
 * mounts, a DOM read per row. This test switches channels the way the rail
 * does and pins down what the second open costs:
 *
 * - the requests it makes, exactly;
 * - the layouts JavaScript forces while it mounts, at most a budget.
 *
 * Both are deterministic, unlike timings. A failure names the unexpected
 * request or the stack that forced each layout. Change them deliberately, in
 * the change that needs it, and say why in its description.
 *
 * The composer mounts before the first page, so a second test holds the page
 * and sends from it.
 */
import { expect, type Page, test } from '@playwright/test';
import {
  channelTimeline,
  newestMessageText,
  postedMessage,
  VIEWER_ID,
} from './channel-open-data';

/** Every request a channel switch makes, with the channel id as `:channel`. */
const EXPECTED_REQUESTS = [
  'GET /dss/agents',
  'GET /dss/call/:channel/active',
  'GET /dss/channels/:channel/bots',
  'GET /dss/channels/:channel/participants',
  'GET /dss/messages/channel/:channel/timeline',
  'POST /auth/user/profile_pictures',
  'POST /dss/channels/activity',
];

/**
 * Layouts forced by scripts while the second channel opens. Eight today:
 * measuring the viewport, positioning at the latest message, one batched row
 * measurement and its scroll correction, the composer editor's selection, and
 * the scrollbar. Two more absorb frame timing. Measuring rows one at a time
 * added a layout per mounted row.
 */
const FORCED_LAYOUT_BUDGET = 10;

const TIMELINE = /\/messages\/channel\/([^/]+)\/timeline$/;
const POST_MESSAGE = /\/messages\/channel\/([^/]+)$/;

async function serveBackend(
  page: Page,
  origin: string,
  requests: string[],
  /** Holds every timeline response until it settles. */
  timelineHeld: Promise<void> = Promise.resolve()
) {
  await page.addInitScript(() => localStorage.setItem('macro:login', 'true'));
  await page.routeWebSocket(/.*/, (socket) => socket.close());
  // Answer every request that would leave the dev server, so nothing reaches
  // a real backend.
  await page.context().route(
    (url) => url.origin !== origin || url.pathname.startsWith('/__macro_dev/'),
    async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/__macro_dev\/[^/]+/, '');
      requests.push(`${route.request().method()} ${path}`);
      if (path.endsWith('/user/legacy_user_permissions'))
        return route.fulfill({
          json: {
            userId: VIEWER_ID,
            email: 'viewer@example.com',
            name: 'Viewer',
            permissions: [],
            licenseStatus: 'active',
            tutorialComplete: true,
            hasChromeExt: false,
            hasTrialed: false,
            aiDataConsent: false,
            referralCode: 'fixture',
          },
        });
      const timeline = path.match(TIMELINE);
      if (timeline) {
        await timelineHeld;
        // A realistic response time, so the skeleton mounts first.
        await new Promise((resolve) => setTimeout(resolve, 60));
        return route.fulfill({ json: channelTimeline(timeline[1]!) });
      }
      const posted = path.match(POST_MESSAGE);
      if (posted && route.request().method() === 'POST')
        return route.fulfill({
          json: postedMessage(posted[1]!, route.request().postDataJSON()),
        });
      if (path.endsWith('/active')) return route.fulfill({ status: 204 });
      if (/\/channels\/[^/]+\/(participants|bots)$/.test(path))
        return route.fulfill({ json: [] });
      return route.fulfill({ status: 404, json: {} });
    }
  );
}

type TraceEvent = {
  name: string;
  ph: string;
  args?: {
    beginData?: { stackTrace?: { functionName: string; url: string }[] };
  };
};

/** One line per layout that the app's scripts forced, naming where. */
function forcedLayouts(trace: Buffer): string[] {
  const { traceEvents } = JSON.parse(trace.toString()) as {
    traceEvents: TraceEvent[];
  };
  return traceEvents.flatMap((event) => {
    if (event.name !== 'Layout' || event.ph !== 'X') return [];
    // Playwright's own page scripts have no URL and do not count.
    const frames = (event.args?.beginData?.stackTrace ?? []).filter((frame) =>
      /\/(src|node_modules)\//.test(frame.url)
    );
    if (frames.length === 0) return [];
    return [
      frames
        .slice(0, 4)
        .map(
          (frame) =>
            `${frame.functionName || '(anonymous)'} ${frame.url.replace(/^.*?\/(src|node_modules)\//, '$1/').split('?')[0]}`
        )
        .join(' <- '),
    ];
  });
}

test('opening a channel stays within its request and layout budget', async ({
  page,
  baseURL,
  browser,
}) => {
  const requests: string[] = [];
  await serveBackend(page, new URL(baseURL ?? '').origin, requests);
  await page.goto('/src/features/channel/browser-test/channel-open.html');

  // The first open pays for module loading and caches shared queries.
  await page.getByRole('button', { name: 'Open channel-a' }).click();
  await expect(
    page.locator('[data-index]').getByText(newestMessageText('channel-a'))
  ).toBeVisible();
  await page.waitForTimeout(1_000);

  requests.length = 0;
  await browser.startTracing(page, {
    categories: [
      'devtools.timeline',
      'disabled-by-default-devtools.timeline.stack',
    ],
  });
  await page.getByRole('button', { name: 'Open channel-b' }).click();
  await expect(
    page.locator('[data-index]').getByText(newestMessageText('channel-b'))
  ).toBeVisible();
  // Late requests and deferred measurements still count.
  await page.waitForTimeout(1_000);
  const layouts = forcedLayouts(await browser.stopTracing());

  expect(
    [...new Set(requests)]
      .map((request) => request.replaceAll('channel-b', ':channel'))
      .sort()
  ).toEqual(EXPECTED_REQUESTS);
  expect(
    layouts.length,
    `Scripts forced ${layouts.length} layouts:\n${layouts.join('\n')}`
  ).toBeLessThanOrEqual(FORCED_LAYOUT_BUDGET);
  // Both opens reported their paint to `channel.open` telemetry.
  expect(
    await page.evaluate(
      () =>
        performance.getEntriesByName('channel.open.painted', 'measure').length
    )
  ).toBe(2);
});

test('the composer sends a message typed while the first page loads', async ({
  page,
  baseURL,
}) => {
  const requests: string[] = [];
  let releaseTimeline!: () => void;
  const timelineHeld = new Promise<void>((resolve) => {
    releaseTimeline = resolve;
  });
  await serveBackend(
    page,
    new URL(baseURL ?? '').origin,
    requests,
    timelineHeld
  );
  await page.goto('/src/features/channel/browser-test/channel-open.html');

  await page.getByRole('button', { name: 'Open channel-a' }).click();
  await expect(
    page.getByRole('status', { name: 'Loading conversation' })
  ).toBeVisible();
  const editor = page.locator(
    '[data-input-id="channel-input-channel-a"] [contenteditable="true"]'
  );
  await editor.click();
  await editor.pressSequentially('Typed before the messages arrived');
  await page.keyboard.press('Enter');

  // Sending cancels in-flight timeline fetches, so the send waits for the
  // first page instead of leaving the channel loading forever.
  await page.waitForTimeout(300);
  expect(requests).not.toContain('POST /dss/messages/channel/channel-a');
  releaseTimeline();

  const rows = page.locator('[data-index]');
  await expect(rows.getByText(newestMessageText('channel-a'))).toBeVisible();
  await expect(
    rows.getByText('Typed before the messages arrived')
  ).toBeVisible();
  expect(requests).toContain('POST /dss/messages/channel/channel-a');
  await expect(editor).toHaveText('');
});
