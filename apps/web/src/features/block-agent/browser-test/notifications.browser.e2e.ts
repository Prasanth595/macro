import { expect, test } from '@playwright/test';

test('response timing follows the decision turn across busy output and the first reply', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Decide', exact: true }).click();
  await expect(page.locator('.agent-working-wave')).toBeVisible();
  await page
    .locator('main')
    .screenshot({ path: test.info().outputPath('responding.png') });
  await page.getByRole('button', { name: 'Busy output' }).click();
  await expect(page.locator('.agent-working-wave')).toBeVisible();
  await page.getByRole('button', { name: 'Receive decision' }).click();
  await expect(page.locator('.agent-working-wave')).toBeVisible();
  await page.getByRole('button', { name: 'Agent reply' }).click();
  await expect(page.locator('.agent-working-wave')).toHaveCount(0);
  await expect(page.locator('[data-turn="1"]')).toHaveText(
    'Your review is complete.'
  );
});

test('request rejection and silent completion both clear the pending response', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Decide', exact: true }).click();
  await expect(page.locator('.agent-working-wave')).toBeVisible();
  await page.getByRole('button', { name: 'Reject request' }).click();
  await expect(page.locator('.agent-working-wave')).toHaveCount(0);
  await page.getByRole('button', { name: 'Decide', exact: true }).click();
  await page.getByRole('button', { name: 'Receive decision' }).click();
  await page.getByRole('button', { name: 'Silent completion' }).click();
  await expect(page.locator('.agent-working-wave')).toHaveCount(0);
  await expect(page.locator('[data-turn]')).toHaveCount(0);
});
