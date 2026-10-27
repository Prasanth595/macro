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
        .getByRole('button', {
          name: 'Companies: Example Company',
          exact: true,
        })
        .click();
      await expect(page.getByTestId('destination')).toContainText('company');
      await expect(page.getByTestId('split-count')).toHaveText('1');
      await expect(page.locator('output').first()).toHaveText('Nothing opened');
      if (!device.hasTouch) {
        await row
          .getByRole('button', {
            name: 'Contacts: Example Contact With a Longer Name',
            exact: true,
          })
          .click({ modifiers: ['Shift'] });
        await expect(page.getByTestId('destination')).toContainText('contact');
        await expect(page.getByTestId('split-count')).toHaveText('2');
      }
      await row
        .getByText('Prepare the renewal proposal', { exact: true })
        .click();
      await expect(page.locator('output').first()).toHaveText('item:task');
      const title = await row
        .getByText('Prepare the renewal proposal', { exact: true })
        .boundingBox();
      const pill = await row
        .getByRole('button', {
          name: 'Companies: Example Company',
          exact: true,
        })
        .boundingBox();
      expect(title).not.toBeNull();
      expect(pill).not.toBeNull();
      expect(
        Math.abs(title!.y + title!.height / 2 - (pill!.y + pill!.height / 2))
      ).toBeLessThan(16);
      await expect(
        page
          .locator('.entity-root')
          .nth(1)
          .getByRole('button', { name: /Companies:|Contacts:/ })
      ).toHaveCount(0);
      expect(
        await page.evaluate(() => document.body.scrollWidth <= innerWidth)
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/crm-associations-${device.name}.png`,
        fullPage: true,
      });
    });

    test('removes a reference after its shared preview loses access', async ({
      page,
    }) => {
      const row = page.locator('.entity-root').first();
      await expect(
        row.getByRole('button', {
          name: 'Companies: Example Company',
          exact: true,
        })
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Revoke additional contacts' })
        .click();
      await expect(
        row.getByRole('button', { name: /more property values/ })
      ).toHaveCount(0);
      await page.getByRole('button', { name: 'Revoke company access' }).click();
      await expect(row.getByRole('button', { name: /Companies:/ })).toHaveCount(
        0
      );
      await expect(
        row.getByText('Prepare the renewal proposal', { exact: true })
      ).toBeVisible();
    });
    test('opens overflow associations by keyboard or touch', async ({
      page,
    }) => {
      const overflow = page
        .locator('.entity-root')
        .first()
        .getByRole('button', { name: 'Show 2 more property values' });
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
      await expect(page.getByTestId('destination')).toContainText(
        'second-contact'
      );
      await expect(page.locator('output').first()).toHaveText('Nothing opened');
      await expect(page.getByRole('menu')).toBeHidden();
    });
  });
}

for (const device of [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, hasTouch: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, hasTouch: true },
]) {
  test.describe(`${device.name} date grouping`, () => {
    test.use({ viewport: device.viewport, hasTouch: device.hasTouch });

    test('groups Tasks and Email across appended pages without remounting rows', async ({
      page,
    }) => {
      await page.goto(
        '/src/features/crm/browser-test/activity-associations.html?mode=dates'
      );
      await page.waitForLoadState('networkidle');
      for (const [tab, first, next, older] of [
        [
          'Tasks',
          'Prepare the renewal proposal',
          'Next task today',
          'Task yesterday',
        ],
        ['Email', 'Next steps', 'Next email today', 'Email yesterday'],
      ]) {
        await page
          .getByLabel('Activity sections')
          .getByText(tab, { exact: true })
          .click();
        const scroll = page.getByTestId('activity-scroll');
        const row = scroll.locator('.entity-root').first();
        await expect(row).toContainText(first);
        await expect(scroll.getByText('Today', { exact: true })).toHaveCount(1);
        await expect(
          scroll.getByText('Yesterday', { exact: true })
        ).toHaveCount(0);
        await expect(scroll.locator('.entity-root')).toHaveCount(12);
        await row.evaluate((element) => {
          element.dataset.firstRow = 'original';
        });
        await scroll.locator('.overflow-y-auto').evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        await expect(scroll.getByText(next, { exact: true })).toBeAttached();
        await expect(scroll.getByText(older, { exact: true })).toBeAttached();
        await expect(scroll.locator('.entity-root')).toHaveCount(14);
        await expect(scroll.getByText('Today', { exact: true })).toHaveCount(1);
        await expect(
          scroll.getByText('Yesterday', { exact: true })
        ).toHaveCount(1);
        await expect(row).toHaveAttribute('data-first-row', 'original');
        await expect(row).toContainText(first);
      }
    });
  });
}
