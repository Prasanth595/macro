import { expect, test } from '@playwright/test';

for (const device of [
  {
    name: 'desktop',
    viewport: { width: 1280, height: 800 },
    hasTouch: false,
    isMobile: false,
  },
  {
    name: 'phone',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  },
  {
    name: 'tablet',
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: false,
  },
]) {
  test.describe(device.name, () => {
    test.use({
      viewport: device.viewport,
      hasTouch: device.hasTouch,
      isMobile: device.isMobile,
    });
    test('creates only on save and resets a temporary filter draft', async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });
      await page.goto('/src/features/tasks-view/browser-test/saved-views.html');
      await page
        .getByRole('button', { name: 'New saved view', exact: true })
        .click();
      await page.getByText('Urgent priority', { exact: true }).click();
      await expect(page.getByLabel('Saved writes')).toHaveText('0');
      await page
        .getByRole('button', { name: 'Save as view', exact: true })
        .click();
      await page.getByLabel('Name', { exact: true }).fill('Urgent work');
      await page.getByText('Share with Example team', { exact: true }).click();
      await page.screenshot({
        path: `/tmp/task-saved-views-${device.name}-dialog.png`,
        fullPage: true,
      });
      await page
        .getByRole('button', { name: 'Save view', exact: true })
        .click();
      await expect(page.getByLabel('Saved writes')).toHaveText('1');
      await expect(
        page.getByRole('button', {
          name: 'Urgent work, shared with team',
          exact: true,
        })
      ).toBeVisible();
      await page.getByText('Urgent priority', { exact: true }).click();
      await expect(page.getByLabel('Saved writes')).toHaveText('1');
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      await expect(
        page.getByRole('checkbox', { name: 'Urgent priority' })
      ).toBeChecked();
      await page.getByText('Urgent priority', { exact: true }).click();
      await page
        .getByRole('button', { name: 'All tasks', exact: true })
        .click();
      await page
        .getByRole('button', {
          name: 'Urgent work, shared with team',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('checkbox', { name: 'Urgent priority' })
      ).toBeChecked();
      await page
        .getByRole('button', { name: 'All tasks', exact: true })
        .click();
      const actions = page.getByRole('button', {
        name: 'Actions for Urgent work',
        exact: true,
      });
      if (!device.hasTouch)
        await page
          .getByRole('button', {
            name: 'Urgent work, shared with team',
            exact: true,
          })
          .hover();
      await actions.click();
      await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
      await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
      await page.getByLabel('Name', { exact: true }).fill('Important work');
      await page.getByRole('button', { name: 'Rename', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'All tasks', exact: true })
      ).toBeVisible();
      const renamedActions = page.getByRole('button', {
        name: 'Actions for Important work',
        exact: true,
      });
      if (!device.hasTouch)
        await page
          .getByRole('button', {
            name: 'Important work, shared with team',
            exact: true,
          })
          .hover();
      await renamedActions.click();
      await page.getByRole('menuitem', { name: 'Share', exact: true }).click();
      await page.getByText('Share with Example team', { exact: true }).click();
      await page
        .getByRole('button', { name: 'Save sharing', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Important work', exact: true })
      ).toBeVisible();
      if (!device.hasTouch) {
        await page
          .getByRole('button', { name: 'Important work', exact: true })
          .click({ button: 'right' });
      } else {
        await renamedActions.click();
      }
      await expect(
        page.getByRole('menuitem', { name: 'Duplicate', exact: true })
      ).toBeVisible();
      await page.screenshot({
        path: `/tmp/task-saved-views-${device.name}-menu.png`,
        fullPage: true,
      });
      await page
        .getByRole('menuitem', { name: 'Duplicate', exact: true })
        .click();
      await expect(page.getByLabel('Name', { exact: true })).toHaveValue(
        'Important work (copy)'
      );
      await page
        .getByRole('button', { name: 'Duplicate', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Important work (copy)', exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Important work', exact: true })
      ).toBeVisible();
      await expect(page.getByLabel('Saved writes')).toHaveText('4');
      expect(pageErrors).toEqual([]);
      await page.screenshot({
        path: `/tmp/task-saved-views-${device.name}.png`,
        fullPage: true,
      });
    });
  });
}
