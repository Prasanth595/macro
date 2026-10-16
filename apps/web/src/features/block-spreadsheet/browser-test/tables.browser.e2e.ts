import { expect, type Page, test } from '@playwright/test';

const cell = (page: Page, address: string) =>
  page.locator(`[data-address="${address}"]`);

async function type(page: Page, address: string, value: string) {
  await cell(page, address).dblclick();
  const input = page.getByRole('textbox', {
    name: `Edit ${address}`,
    exact: true,
  });
  await input.fill(value);
  await input.press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(cell(page, 'B4')).toHaveText('30');
});

test('a range becomes a table that filters, sorts, totals and grows', async ({
  page,
}) => {
  const grid = page.getByRole('grid', { name: 'Spreadsheet' });
  // The seeded total line would block a total row below the table.
  await cell(page, 'A4').click();
  await cell(page, 'B4').click({ modifiers: ['Shift'] });
  await page.keyboard.press('Delete');
  await cell(page, 'A1').click();
  await cell(page, 'B3').click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Format and data' }).click();
  await page.getByRole('menuitem', { name: 'Convert to table…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Convert to table' });
  await expect(dialog.getByRole('textbox', { name: 'Range' })).toHaveValue(
    'A1:B3'
  );
  await expect(dialog.getByRole('textbox', { name: 'Table name' })).toHaveValue(
    'Table1'
  );
  await dialog.getByLabel('Total row').check();
  await dialog.getByRole('button', { name: 'Create table' }).click();
  await expect(dialog).toBeHidden();
  await expect(grid).toBeFocused();
  await expect(cell(page, 'A4')).toHaveText('Total');
  await expect(cell(page, 'B4')).toHaveText('30');

  await type(page, 'D6', '=SUBTOTAL(109,Table1[Amount])');
  await type(page, 'D7', '=SUM(Table1[Amount])');
  await expect(cell(page, 'D6')).toHaveText('30');

  // A filter hides rows; SUBTOTAL leaves them out and SUM keeps them.
  await page.getByRole('button', { name: 'Sort and filter Item' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Design' }).click();
  await page.keyboard.press('Escape');
  await expect(cell(page, 'A2')).toHaveCount(0);
  await expect(cell(page, 'D6')).toHaveText('20');
  await expect(cell(page, 'D7')).toHaveText('30');
  await expect(cell(page, 'B4')).toHaveText('20');
  await page.getByRole('button', { name: 'Sort and filter Item' }).click();
  await page.getByRole('menuitem', { name: 'Clear filter' }).click();
  await expect(cell(page, 'A2')).toHaveText('Design');
  await expect(cell(page, 'D6')).toHaveText('30');

  await page.getByRole('button', { name: 'Sort and filter Amount' }).click();
  await page.getByRole('menuitem', { name: 'Sort Z → A' }).click();
  await expect(cell(page, 'A2')).toHaveText('Engineering');
  await expect(cell(page, 'A3')).toHaveText('Design');

  // The total row's cells choose their aggregate.
  await cell(page, 'B4').click();
  await page.getByRole('button', { name: 'Choose a value for B4' }).click();
  await page.getByRole('menuitem', { name: 'Average' }).click();
  await expect(cell(page, 'B4')).toHaveText('15');

  // Typing right of the table adds a named column.
  await type(page, 'C2', 'yes');
  await expect(cell(page, 'C1')).toHaveText('Column3');
  await expect(
    page.getByRole('button', { name: 'Sort and filter Column3' })
  ).toBeVisible();

  // Renaming the table renames the formulas that use it.
  await cell(page, 'A2').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Table options…' }).click();
  const options = page.getByRole('dialog', { name: 'Table options' });
  await options.getByRole('textbox', { name: 'Table name' }).fill('Budget');
  await options.getByRole('button', { name: 'Save' }).click();
  await expect(options).toBeHidden();
  await cell(page, 'D7').click();
  await expect(page.getByRole('textbox', { name: 'Formula bar' })).toHaveValue(
    '=SUM(Budget[Amount])'
  );
  await expect(cell(page, 'D7')).toHaveText('30');

  // Converting back to a range keeps the results with cell ranges.
  await cell(page, 'A2').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Table options…' }).click();
  await options.getByRole('button', { name: 'Convert to range' }).click();
  await expect(options).toBeHidden();
  await expect(
    page.getByRole('button', { name: /^Sort and filter/ })
  ).toHaveCount(0);
  await cell(page, 'D7').click();
  await expect(page.getByRole('textbox', { name: 'Formula bar' })).toHaveValue(
    '=SUM($B$2:$B$3)'
  );
});
