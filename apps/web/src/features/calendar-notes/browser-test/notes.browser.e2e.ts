import { expect, test } from '@playwright/test';

test('an owner can revoke a missing meeting’s team grant from document sharing', async ({
  page,
}) => {
  await page.goto('/?document=1');
  const links = page.getByRole('region', { name: 'Meeting links' });
  await expect(links).toContainText('Unavailable meeting');
  await expect(links).toContainText('Design team');
  await links.getByRole('button', { name: 'Unlink', exact: true }).click();
  await links.getByRole('button', { name: 'Keep link' }).click();
  await expect(links).toBeVisible();
  await links.getByRole('button', { name: 'Unlink', exact: true }).click();
  await links
    .getByRole('button', { name: 'Unlink meeting', exact: true })
    .click();
  await expect(links).not.toBeVisible();
  await expect(page.getByText('Your document is saved.')).toBeVisible();
});

test('link a note, optionally share with a team, open it, and unlink it', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Link a note', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('button', { name: 'Link note', exact: true })
  ).toBeDisabled();
  await dialog
    .getByRole('textbox', { name: 'Find a markdown document' })
    .fill('weekly');
  await dialog
    .getByRole('button', { name: 'Weekly design sync', exact: true })
    .click();
  await expect(
    dialog.getByRole('checkbox', { name: 'Design team' })
  ).not.toBeChecked();
  await expect(
    dialog.getByRole('button', { name: 'Link note', exact: true })
  ).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('link-note.png') });
  await dialog.getByRole('button', { name: 'Link note', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Manage note access' }).click();
  await dialog.getByText('Design team', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Save access' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Manage note access' })
  ).toContainText('Design team');
  await page.screenshot({ path: testInfo.outputPath('linked-note.png') });
  await page
    .getByRole('button', { name: 'Weekly design sync', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveText(
    'Opened Weekly design sync'
  );
  await page.getByRole('button', { name: 'Unlink Weekly design sync' }).click();
  await dialog
    .getByRole('button', { name: 'Unlink note', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Link a note', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Link a note', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Weekly design sync', exact: true })
  ).toBeEnabled();
});

test('a failed link preserves the selected document and sharing choice for retry', async ({
  page,
}) => {
  await page.goto('/?fail=1');
  await page.getByRole('button', { name: 'Link a note', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('button', { name: 'Weekly design sync', exact: true })
    .click();
  await dialog.getByText('Design team', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Link note', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Weekly design sync', exact: true })
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    dialog.getByRole('checkbox', { name: 'Design team' })
  ).toBeChecked();
  await dialog.getByRole('button', { name: 'Link note', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Manage note access' })
  ).toContainText('Design team');
});

test('search, dismiss, and reopen reset the unfinished choice', async ({
  page,
}) => {
  await page.goto('/?theme=dark');
  const trigger = page.getByRole('button', {
    name: 'Link a note',
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('no matching note');
  await expect(dialog.getByText('No notes match this name.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await expect(dialog.getByRole('textbox')).toHaveValue('');
  await expect(
    dialog.getByRole('button', { name: 'Link note', exact: true })
  ).toBeDisabled();
  await expect(dialog.getByRole('checkbox')).not.toBeChecked();
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('body').evaluate((body) => body.clientWidth)
  );
});
