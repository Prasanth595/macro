import { expect, test } from '@playwright/test';

test('God Mode lives in Settings and immediately controls Command K, with a remembered account preference', async ({
  page,
}) => {
  await page.goto('/?settings&command-menu&eligible');
  const settings = page.getByTestId('experimental-settings');
  await expect(
    settings.getByRole('heading', { name: 'Experimental Features' })
  ).toBeVisible();
  const toggle = settings.getByRole('switch', { name: 'God Mode' });
  await expect(toggle).toBeChecked();
  await expect(settings).toContainText(
    'Command Menu (cmd + k) prompts automatically turn into tasks, events, emails, and more. Powered by Jev-ian technology.'
  );
  await page
    .getByRole('button', { name: 'Open Command K', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByPlaceholder('Search...', { exact: true })
    .fill('Call Julia tomorrow at 7');
  await expect(
    dialog.getByRole('textbox', { name: 'Your input', exact: true })
  ).toBeFocused();
  await dialog.press('Escape');
  await page.reload();
  await expect(toggle).toBeChecked();
  await settings.locator('[id$="-control"]').click();
  await page
    .getByRole('button', { name: 'Open Command K', exact: true })
    .click();
  const search = dialog.getByPlaceholder('Search...', { exact: true });
  await search.fill('Call Julia tomorrow at 7');
  await expect(search).toBeVisible();
  await expect(
    dialog.getByRole('textbox', { name: 'Your input', exact: true })
  ).toHaveCount(0);
  await dialog.press('Escape');
  await page.reload();
  await expect(toggle).not.toBeChecked();
  await toggle.press('Space');
  await expect(toggle).toBeChecked();
});

test('external accounts cannot see experimental settings even with a saved preference', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'macro:experimental:god-mode:experimental-fixture',
      'true'
    )
  );
  await page.goto('/?settings&command-menu&eligible&external');
  await expect(page.getByTestId('experimental-settings')).toHaveCount(0);
});

test('the PostHog gate hides experimental settings even for staff', async ({
  page,
}) => {
  await page.goto('/?settings&command-menu');
  await expect(page.getByTestId('experimental-settings')).toHaveCount(0);
});

test('the Universal Input flag hides God Mode without hiding Experimental Features', async ({
  page,
}) => {
  await page.goto('/?settings&command-menu&eligible&no-universal');
  const settings = page.getByTestId('experimental-settings');
  await expect(
    settings.getByRole('heading', { name: 'Experimental Features' })
  ).toBeVisible();
  await expect(settings.getByRole('switch', { name: 'God Mode' })).toHaveCount(
    0
  );
  await page
    .getByRole('button', { name: 'Open Command K', exact: true })
    .click();
  const search = page
    .getByRole('dialog')
    .getByPlaceholder('Search...', { exact: true });
  await search.fill('Call Julia tomorrow at 7');
  await expect(search).toBeVisible();
});
