import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByRole('combobox')).toBeFocused();
});

test('Escape closes Share, restores its trigger, and keeps the database open', async ({
  page,
}) => {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Share', exact: true })
  ).toBeFocused();
  await expect(page.getByLabel('Database Escape handlers')).toHaveText('0');
});

test('Escape closes recipient suggestions before Share', async ({ page }) => {
  await page.getByRole('combobox').fill('member@example.com');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Share', exact: true })
  ).toBeFocused();
});

test('Escape clears an unmatched search before dismissing Share', async ({
  page,
}) => {
  await page.getByRole('combobox').fill('unmatched');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('combobox')).toHaveValue('');
  await expect(page.getByRole('listbox', { includeHidden: true })).toHaveCount(
    0
  );
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Escape closes nested permission menus before Share', async ({ page }) => {
  await page.getByRole('button', { name: 'Can view' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Share', exact: true })
  ).toBeFocused();
});

test('outside clicks and dialog actions still dismiss Share', async ({
  page,
}) => {
  await page.mouse.click(10, 10);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
