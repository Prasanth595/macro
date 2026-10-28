import { expect, type Locator, type Page, test } from '@playwright/test';

async function swipeToEnd(page: Page, last: Locator) {
  const cdp = await page.context().newCDPSession(page);
  const height = page.viewportSize()!.height;
  for (let swipe = 0; swipe < 5; swipe++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 190, y: height - 200 }],
    });
    for (let y = height - 220; y >= 140; y -= 20) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 190, y }],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  }
  await cdp.detach();
  await expect(last).toBeInViewport();
}

for (const device of [
  { name: 'small phone', width: 320, height: 568, hasTouch: true },
  { name: 'phone', width: 390, height: 844, hasTouch: true },
  { name: 'tablet', width: 1024, height: 768, hasTouch: true },
  { name: 'desktop', width: 1280, height: 800, hasTouch: false },
]) {
  test.describe(device.name, () => {
    // A cold Vite server compiles the production shell's shared dependencies.
    test.setTimeout(180_000);
    test.use({
      viewport: { width: device.width, height: device.height },
      hasTouch: device.hasTouch,
    });
    test.beforeEach(async ({ page }) => {
      page.on('pageerror', (error) => console.error(error.message));
      page.on('requestfailed', (request) => {
        if (request.url().startsWith('http://localhost:'))
          console.error(request.failure()?.errorText, request.url());
      });
      await page.routeWebSocket('**', (socket) => socket.close());
      await page.route('https://**', (route) => route.abort());
      await page.route('**/__macro_dev/**', (route) => route.abort());
    });

    for (const surface of ['company', 'contact', 'crm', 'reviews', 'project']) {
      test(`${surface} clears navigation without double insets`, async ({
        page,
      }, testInfo) => {
        await page.goto(
          `/src/features/crm/browser-test/mobile-insets.html?surface=${surface}`,
          { waitUntil: 'domcontentloaded' }
        );
        if (surface === 'company' || surface === 'contact') {
          const heading = page.getByRole('heading');
          await expect(heading).toBeVisible({ timeout: 30000 });
          const box = await heading.boundingBox();
          expect(box?.y).toBe(device.hasTouch ? 116 : 48);
          await page.screenshot({
            path: testInfo.outputPath('overview-top.png'),
          });
          if (device.hasTouch) {
            const sections = page.getByRole('button', {
              name: /^Record sections:/,
            });
            await expect(sections).toBeVisible();
            const sectionsBox = await sections.boundingBox();
            expect(sectionsBox!.height).toBeGreaterThanOrEqual(36);
            expect(sectionsBox!.y).toBeGreaterThanOrEqual(47);
            expect(sectionsBox!.x).toBeGreaterThanOrEqual(0);
            expect(sectionsBox!.x + sectionsBox!.width).toBeLessThan(
              device.width - 40
            );
            const names =
              surface === 'company'
                ? ['Team', 'Emails', 'Tasks', 'Calls', 'Files']
                : ['Emails', 'Tasks', 'Calls', 'Files'];
            for (const name of names) {
              await sections.tap();
              const option = page.getByRole('menuitemradio', {
                name,
                exact: true,
              });
              await expect
                .poll(async () => (await option.boundingBox())?.height ?? 0)
                .toBeGreaterThanOrEqual(44);
              await option.tap();
              await expect(
                page.getByRole('searchbox', {
                  name: `Search ${name.toLowerCase()}`,
                })
              ).toBeVisible();
              await expect(sections).toHaveAccessibleName(
                `Record sections: ${name}`
              );
            }
            const search = page.getByRole('searchbox', {
              name: 'Search files',
            });
            await expect(search).toBeVisible();
            const searchBox = await search.boundingBox();
            expect(searchBox!.y).toBeGreaterThanOrEqual(100);
            expect(searchBox!.y).toBeLessThan(112);
            await search.fill('proposal');
            await expect(page.getByText('Searching: proposal')).toBeVisible();
            await swipeToEnd(
              page,
              page.getByRole('button', { name: 'Last record action' })
            );
            await sections.tap();
            await expect(
              page.getByRole('menuitemradio', { name: 'Files', exact: true })
            ).toHaveAttribute('aria-checked', 'true');
            await page.keyboard.press('Escape');
            await expect(sections).toBeFocused();
            await sections.tap();
            await page
              .getByRole('menuitemradio', { name: 'Overview', exact: true })
              .tap();
            await expect(heading).toBeVisible({ timeout: 30000 });
          }
          const last = page.getByRole('button', { name: 'Last action' });
          if (device.hasTouch) {
            await swipeToEnd(page, last);
          } else {
            await last.evaluate((element) => {
              const scroller = element.closest('.overflow-y-auto');
              if (scroller) scroller.scrollTop = scroller.scrollHeight;
            });
          }
          await expect(last).toBeVisible();
          const lastBox = await last.boundingBox();
          expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(
            device.height - (device.hasTouch ? 128 : 48)
          );
        } else if (surface === 'project') {
          const button = page.getByRole('button', { name: 'Project tasks' });
          await expect(button).toBeVisible();
          const box = await button.boundingBox();
          expect(box!.y).toBeGreaterThanOrEqual(device.hasTouch ? 59 : 0);
          expect(box!.y).toBeLessThan(device.hasTouch ? 64 : 20);
          await button.click();
          await expect(page.getByText('Selected: tasks')).toBeVisible();
        } else {
          const button = page.getByRole('button', {
            name: 'People',
            exact: true,
          });
          await expect(button).toBeVisible({ timeout: 30000 });
          const box = await button.boundingBox();
          const top = device.hasTouch ? (surface === 'reviews' ? 100 : 55) : 16;
          expect(box!.y).toBeGreaterThanOrEqual(top);
          expect(box!.y).toBeLessThan(top + 5);
          await button.click();
          await expect(page.getByText('Selected: people')).toBeVisible();
          await page
            .getByRole('button', { name: 'Sales', exact: true })
            .click();
          await expect(
            page.getByText('Selected: pipeline:sales')
          ).toBeVisible();
        }
        await page.screenshot({
          path: testInfo.outputPath(`${surface}-${device.name}.png`),
        });
      });
    }
  });
}
