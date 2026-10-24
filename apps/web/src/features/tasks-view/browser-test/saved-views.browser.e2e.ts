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
    test('keeps keyboard focus through picker menus and dialog handoffs', async ({
      page,
    }) => {
      await page.goto(
        '/src/features/tasks-view/browser-test/saved-views.html?picker'
      );
      await page
        .getByRole('button', { name: 'Save as view', exact: true })
        .click();
      await page.getByLabel('Name', { exact: true }).fill('Keyboard view');
      await page
        .getByRole('dialog', { name: 'Save view', exact: true })
        .getByRole('button', { name: 'Save view', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const picker = page.getByRole('button', {
        name: 'Browse saved views',
        exact: true,
      });
      for (const action of [
        { name: 'Rename', title: 'Rename saved view', steps: 0 },
        { name: 'Share', title: 'Share saved view', steps: 1 },
        { name: 'Duplicate', title: 'Duplicate saved view', steps: 2 },
        { name: 'Delete view', title: 'Delete saved view?', steps: 4 },
      ]) {
        await picker.click();
        const drawer = page.getByRole('dialog', {
          name: 'Saved views',
          exact: true,
        });
        await expect(drawer).toBeVisible();
        await expect(drawer).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
        await expect(drawer).not.toHaveAttribute('data-transitioning', '');
        if (action.name === 'Duplicate') {
          await drawer
            .getByRole('button', { name: 'Keyboard view', exact: true })
            .click({ button: 'right' });
        } else {
          await page
            .getByRole('button', {
              name: 'Actions for Keyboard view',
              exact: true,
            })
            .press('ArrowDown');
        }
        await expect(
          page.getByRole('menuitem', { name: 'Rename', exact: true })
        ).toBeFocused();
        for (let step = 0; step < action.steps; step++)
          await page.keyboard.press('ArrowDown');
        await expect(
          page.getByRole('menuitem', { name: action.name, exact: true })
        ).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(drawer).toBeHidden();
        const dialog = page.getByRole('dialog', {
          name: action.title,
          exact: true,
        });
        await expect(dialog).toBeVisible();
        if (device.name === 'phone') {
          await expect(dialog).toHaveCSS(
            'transform',
            'matrix(1, 0, 0, 1, 0, 0)'
          );
          await expect(dialog).not.toHaveAttribute('data-transitioning', '');
        }
        await expect(dialog.locator(':focus')).toHaveCount(1);
        if (action.name === 'Rename' || action.name === 'Duplicate')
          await expect(
            dialog.getByLabel('Name', { exact: true })
          ).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(dialog.locator(':focus')).toHaveCount(1);
        await page.screenshot({
          path: `/tmp/saved-view-${device.name}-${action.name.replaceAll(' ', '-')}-focus.png`,
        });
        await expect(dialog.locator(':focus')).toHaveCount(1);
        if (action.name === 'Delete view')
          await dialog
            .getByRole('button', { name: 'Delete view', exact: true })
            .click();
        else await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }
    });
    test('discards queued picker actions when the account changes', async ({
      page,
    }) => {
      await page.goto(
        '/src/features/tasks-view/browser-test/saved-views.html?picker'
      );
      await page
        .getByRole('button', { name: 'Save as view', exact: true })
        .click();
      await page.getByLabel('Name', { exact: true }).fill('Private view');
      await page
        .getByRole('dialog', { name: 'Save view', exact: true })
        .getByRole('button', { name: 'Save view', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Browse saved views', exact: true })
        .click();
      const drawer = page.getByRole('dialog', {
        name: 'Saved views',
        exact: true,
      });
      await expect(drawer).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
      await expect(drawer).not.toHaveAttribute('data-transitioning', '');
      await page
        .getByRole('button', { name: 'Actions for Private view', exact: true })
        .click();
      // An authentication event can arrive in the same turn as the menu action.
      await page
        .getByRole('menuitem', { name: 'Duplicate', exact: true })
        .evaluate((item) => {
          item.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Enter',
              bubbles: true,
              cancelable: true,
            })
          );
          document
            .querySelector<HTMLButtonElement>('[data-switch-account]')
            ?.click();
        });
      await expect(drawer).toBeHidden();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByLabel('Saved writes')).toHaveText('1');
    });
  });
}
