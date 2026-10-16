import { expect, test } from '@playwright/test';
import { openFixture } from './open-fixture';

test('database titles stay static until Rename is requested and save without entering the grid', async ({
  page,
}) => {
  await page.route('https://**', (route) => route.abort());
  await page.route('**/__macro_dev/**', (route) => route.abort());
  await openFixture(page, '/src/features/block-database/browser-test/api.html');
  await expect(
    page.getByText('Untitled database', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Database name' })
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Rename database', exact: true })
    .click();
  const title = page.getByRole('textbox', { name: 'Database name' });
  await expect(title).toBeFocused();
  await title.fill('Projects');
  await title.press('Enter');
  await expect(title).toHaveCount(0);
  await expect(page.getByText('Projects', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Edit Name' })).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Rename database', exact: true })
    .click();
  await title.fill('Discarded');
  await title.press('Escape');
  await expect(title).toHaveCount(0);
  await expect(page.getByText('Projects', { exact: true })).toBeVisible();
});

test('adds a column and starts naming it while creation is still saving', async ({
  page,
}) => {
  await page.route('https://**', (route) => route.abort());
  await page.route('**/__macro_dev/**', (route) => route.abort());
  await openFixture(
    page,
    '/src/features/block-database/browser-test/api.html?holdColumnWrites'
  );
  await page.getByRole('button', { name: 'Add column', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'Column name', exact: true });
  await expect(name).toBeFocused();
  await expect(page.getByLabel('API writes')).toHaveText('0');
  await name.fill('Tasks');
  await name.press('Enter');
  await expect(name).toHaveCount(0);
  await expect(
    page.getByRole('columnheader', { name: 'Tasks', exact: true })
  ).toBeVisible();
  // The schema may still show its previous name while the rename is queued.
  const editor = page.getByRole('textbox', { name: /^Edit (Unnamed|Tasks)$/ });
  await expect(editor).toBeFocused();
  await expect(page.getByLabel('API writes')).toHaveText('0');
  await editor.fill('First task');
  await editor.press('Enter');
  await expect(editor).toBeFocused();
  await expect(page.getByLabel('API writes')).toHaveText('0');
  await page.getByRole('button', { name: 'Release column saves' }).click();
  await expect(
    page.getByRole('columnheader', { name: 'Tasks', exact: true })
  ).toBeVisible();
  await expect(page.getByLabel('API writes')).toHaveText('3');
  await expect(
    page.getByRole('button', { name: /^Tasks: First task\./ })
  ).toBeVisible();
});

test('an API-only host pages rows, writes cells and creates columns through the shared controller', async ({
  page,
}) => {
  await page.route('https://**', (route) => route.abort());
  await page.route('**/__macro_dev/**', (route) => route.abort());
  await openFixture(page, '/src/features/block-database/browser-test/api.html');
  await expect(page.getByRole('grid', { name: 'API records' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^Name: Second\./ })
  ).toBeVisible();
  await page.getByRole('button', { name: /^Name: First\./ }).dblclick();
  const input = page.getByRole('textbox', { name: 'Edit Name' });
  await input.fill('Changed through API');
  await input.press('Tab');
  await expect(page.getByLabel('API writes')).toHaveText('1');
  await page.getByRole('button', { name: 'Add column', exact: true }).click();
  await expect(page.getByLabel('API writes')).toHaveText('2');
  await expect(
    page.getByRole('columnheader', { name: 'Unnamed', exact: true })
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Toggle editing' }).click();
  await expect(
    page.getByRole('button', { name: 'Add column', exact: true })
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle editing' }).click();
  await page.getByRole('button', { name: 'Show board' }).click();
  await expect(
    page.getByText('Changed through API', { exact: true }).first()
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Move Changed through API', exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Drag Changed through API', exact: true })
  ).toHaveCount(0);
});
