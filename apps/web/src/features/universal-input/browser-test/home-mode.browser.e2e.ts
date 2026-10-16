import { expect, test } from '@playwright/test';

test('God Mode starts at the usual Home input position across page heights', async ({
  page,
}) => {
  await page.goto('/home-mode.html?home&eligible');
  for (const height of [700, 1000]) {
    await page.setViewportSize({ width: 1000, height });
    await page
      .locator('[data-split-id="fixture"]')
      .first()
      .evaluate((element, height) => {
        element.style.height = `${height - 100}px`;
      }, height);
    const usual = page.getByLabel('Usual Home input');
    await expect(usual).toBeVisible();
    const before = await usual.boundingBox();
    await page.getByText('God Mode', { exact: true }).click();
    const surface = page.getByTestId('universal-input-surface');
    await expect(surface).toBeVisible();
    const after = await surface.boundingBox();
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
    await page.getByText('God Mode', { exact: true }).click();
  }
});

test('unflagged Home does not offer or mount Universal Input, even with a saved preference', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('home-composer-mode-persist-v0:alice', 'true')
  );
  await page.goto('/home-mode.html?home');
  await expect(page.getByLabel('Usual Home input')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'God Mode' })).toHaveCount(0);
  await expect(page.getByTestId('universal-mounts')).toHaveText('0');
  await expect(
    page.getByRole('textbox', { name: 'Your input', exact: true })
  ).toHaveCount(0);
});

test('eligible users can switch modes, preserve the Universal Input draft, and restore their preference on reload', async ({
  page,
}) => {
  await page.goto('/home-mode.html?home&eligible');
  const toggle = page.getByRole('switch', { name: 'God Mode' });
  await expect(toggle).not.toBeChecked();
  await expect(page.getByLabel('Usual Home input')).toBeVisible();
  await page.screenshot({ path: '/tmp/home-standard-toggle.png' });
  await page.getByText('God Mode', { exact: true }).click();
  await expect(toggle).toBeChecked();
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('Research notes for launch');
  await expect(
    page.getByRole('button', { name: 'Create note', exact: true })
  ).toBeEnabled();
  await expect(page.getByText('Usual Home suggestions')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/home-universal-toggle.png' });
  await page.getByText('God Mode', { exact: true }).click();
  await expect(page.getByLabel('Usual Home input')).toBeVisible();
  await expect(input).toHaveCount(0);
  await page.getByText('God Mode', { exact: true }).click();
  await expect(input).toHaveText('Research notes for launch');
  await page.reload();
  await expect(toggle).toBeChecked();
  await expect(input).toHaveText('Research notes for launch');
  await page
    .getByRole('button', { name: 'Revoke access', exact: true })
    .click();
  await expect(toggle).toHaveCount(0);
  await expect(input).toHaveCount(0);
  await expect(page.getByLabel('Usual Home input')).toBeVisible();
  await expect(page.getByText('Usual Home suggestions')).toBeVisible();
});

test('mode choice belongs to the signed-in user and supports keyboard toggling', async ({
  page,
}) => {
  await page.goto('/home-mode.html?home&eligible&legacy');
  const toggle = page.getByRole('switch', { name: 'God Mode' });
  await expect(
    page.getByRole('heading', { name: 'What should we get done in Macro?' })
  ).toBeVisible();
  await toggle.focus();
  await toggle.press('Space');
  await expect(toggle).toBeChecked();
  await expect(
    page.getByRole('textbox', { name: 'Your input', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Switch user', exact: true }).click();
  await expect(page.getByTestId('identity')).toHaveText('bob');
  await expect(toggle).not.toBeChecked();
  await expect(page.getByLabel('Usual Home input')).toBeVisible();
  await page.getByRole('button', { name: 'Switch user', exact: true }).click();
  await expect(toggle).toBeChecked();
});
