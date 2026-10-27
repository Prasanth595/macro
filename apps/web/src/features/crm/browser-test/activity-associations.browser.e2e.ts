import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket('**', (socket) => socket.close());
  await page.route('https://**', (route) => route.abort());
  await page.route(/^http:\/\/localhost:\d+\//, async (route) => {
    await route.fulfill({ response: await route.fetch({ maxRetries: 2 }) });
  });
  await page.route('**/__macro_dev/**', (route) => route.abort());
  // Match the other CRM fixtures: retry a canceled startup, never an interaction.
  let networkChanged = false;
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText === 'net::ERR_NETWORK_CHANGED')
      networkChanged = true;
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    networkChanged = false;
    await page.goto(
      '/src/features/crm/browser-test/activity-associations.html'
    );
    await page.waitForLoadState('networkidle');
    if (!networkChanged) break;
  }
  await expect(page.locator('.entity-root')).toHaveCount(4, {
    timeout: 30_000,
  });
});

for (const device of [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, hasTouch: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, hasTouch: true },
]) {
  test.describe(device.name, () => {
    test.use({ viewport: device.viewport, hasTouch: device.hasTouch });

    test('opens an association without opening its parent row', async ({
      page,
    }) => {
      const row = page.locator('.entity-root').first();
      await row
        .getByRole('button', { name: 'Example Company', exact: true })
        .click();
      await expect(page.locator('output')).toHaveText(
        'company:company:current'
      );
      if (!device.hasTouch) {
        await row
          .getByRole('button', { name: 'Example Company', exact: true })
          .click({ modifiers: ['Shift'] });
        await expect(page.locator('output')).toHaveText('company:company:new');
      }
      await row
        .getByText('Prepare the renewal proposal', { exact: true })
        .click();
      await expect(page.locator('output')).toHaveText('item:task');
      expect(
        await page.evaluate(() => document.body.scrollWidth <= innerWidth)
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/crm-associations-${device.name}.png`,
        fullPage: true,
      });
    });

    test('opens overflow associations by keyboard or touch', async ({
      page,
    }) => {
      const overflow = page
        .locator('.entity-root')
        .first()
        .getByRole('button', { name: 'Show 2 more associations' });
      if (device.hasTouch) await overflow.tap();
      else {
        await overflow.focus();
        await page.keyboard.press('Enter');
      }
      const contact = page.getByRole('menuitem', { name: 'Second Contact' });
      await expect(contact).toBeVisible();
      if (device.hasTouch) await contact.tap();
      else {
        await contact.focus();
        await page.keyboard.press('Enter');
      }
      await expect(page.locator('output')).toHaveText(
        'contact:second-contact:current'
      );
      await expect(page.getByRole('menu')).toBeHidden();
    });
  });
}
