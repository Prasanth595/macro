import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  test.setTimeout(120_000);
  await page.routeWebSocket('**', (socket) => socket.close());
  await page.route('https://**', (route) => route.abort());
  await page.route('**/__macro_dev/**', (route) => route.abort());
  await page.goto('/src/features/crm/browser-test/files.html', {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('button', { name: 'Set up file types' }).click();
});

test('the same source file keeps its type on both records and surfaces', async ({
  page,
}) => {
  const select = page.getByRole('button', {
    name: 'File type for Shared contract',
  });
  await select.click();
  await page.getByRole('option', { name: 'Contract', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Contract', exact: true })
  ).toContainText('Shared contract');
  await expect(
    page.getByRole('button', { name: 'File type for Read-only proposal' })
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Switch record' }).click();
  await expect(select).toHaveText('Contract');
  await page.getByRole('button', { name: 'Switch surface' }).click();
  await expect(select).toHaveText('Contract');
  await page.getByText('Shared contract', { exact: true }).click();
  await expect(page.getByLabel('Opened file')).toHaveText('shared');
  await page.screenshot({ path: '/tmp/macro-3927-files-desktop.png' });
  await page.getByRole('button', { name: 'Simulate unavailable type' }).click();
  await expect(select).toHaveText('Type unavailable');
  await expect(select).toBeDisabled();
});

test('team labels update existing groups and removal leaves files unclassified', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'File type for Shared contract' })
    .click();
  await page.getByRole('option', { name: 'Contract', exact: true }).click();
  await page.getByRole('button', { name: 'Manage types' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('textbox', { name: 'Rename Contract' })
    .fill('Agreement');
  await dialog
    .getByRole('button', { name: 'Save', exact: true })
    .first()
    .click();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(
    page.getByRole('region', { name: 'Agreement', exact: true })
  ).toContainText('Shared contract');
  await page.getByRole('button', { name: 'Manage types' }).click();
  await dialog
    .getByRole('button', { name: 'Remove', exact: true })
    .first()
    .click();
  await dialog.getByRole('button', { name: 'Remove type' }).click();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(
    page.getByRole('region', { name: 'Unclassified', exact: true })
  ).toContainText('Shared contract');
});

test.describe('phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test('mobile creation retries without duplicates and attaching preserves its type', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Fail next attachment' }).click();
    await page.getByRole('button', { name: 'Add file', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText('New note', { exact: true }).click();
    await dialog
      .getByRole('textbox', { name: 'File name' })
      .fill('October invoice');
    await dialog.getByRole('button', { name: /^File type / }).click();
    const invoice = page.getByRole('option', { name: 'Invoice', exact: true });
    expect(
      await invoice.evaluate((option) =>
        Boolean(option.closest('[data-corvu-drawer-content]'))
      )
    ).toBe(true);
    await invoice.tap();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Create and attach' }).click();
    await expect(dialog.getByRole('alert')).toContainText(
      'The file was created'
    );
    await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByLabel('Created files')).toHaveText('1');
    await page.getByRole('button', { name: 'Switch record' }).click();
    await page.getByRole('button', { name: 'Add file', exact: true }).click();
    await dialog
      .getByRole('button', { name: 'October invoice', exact: true })
      .click();
    await dialog
      .getByRole('button', { name: 'Attach file', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Invoice', exact: true })
    ).toContainText('October invoice');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await page.screenshot({ path: '/tmp/macro-3927-files-mobile.png' });
  });
});
