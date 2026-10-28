import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

test('stopping and reloading a reply keeps complete chips and hides partial XML', async ({
  page,
}) => {
  await page.goto('/mentions.html');
  const reply = page.getByRole('region', { name: 'Agent reply' });
  await expect(reply).toContainText('Project notes', { timeout: 30_000 });
  await expect(reply).toContainText('The next reference is');
  await expect(reply).not.toContainText('unfinished');

  await page.getByRole('button', { name: 'Stop response' }).click();
  await expect(
    page.getByRole('button', { name: 'Stopped', exact: true })
  ).toBeVisible();
  await expect(reply).not.toContainText('unfinished');
  await expect(reply).not.toContainText('<m-');

  await page.reload();
  await expect(reply).toContainText('Project notes');
  await expect(reply).toContainText('The next reference is');
  await expect(reply).not.toContainText('unfinished');
  await expect(reply).not.toContainText('<m-');
});
