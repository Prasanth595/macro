import { expect, test } from '@playwright/test';

test('complete document coverage groups every cached task beyond 5,000 and recovers after invalidation', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  const messages: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') messages.push(message.text());
  });
  await page.goto('collection-coverage.html');
  await page.bringToFront();
  expect(errors).toEqual([]);
  const result = page.locator('#result');
  const groups = page.locator('#groups li');
  try {
    await expect(result).toHaveAttribute('data-status', 'incomplete', {
      timeout: 150_000,
    });
  } catch (error) {
    throw new Error(
      `${String(error)}\nStage: ${await result.getAttribute('data-stage')}\n${messages.join('\n')}`
    );
  }
  await expect(groups).toHaveCount(0);
  await page.getByRole('button', { name: 'Complete backfill' }).click();
  await expect(result).toHaveAttribute('data-status', 'complete', {
    timeout: 60_000,
  });
  await expect(result).toHaveAttribute('data-count', '5002');
  await expect(groups).toHaveCount(2);
  expect(await groups.allTextContents()).toEqual(
    expect.arrayContaining([
      '20000000-0000-0000-0000-000000000002: 2501',
      '20000000-0000-0000-0000-000000000001: 2501',
    ])
  );
  const reads = await result.getAttribute('data-reads');
  if (!reads) throw new Error('missing cache read count');
  await page.getByRole('button', { name: 'Group by project' }).click();
  await expect(groups).toHaveCount(2);
  expect(await groups.allTextContents()).toEqual(
    expect.arrayContaining([
      '40000000-0000-0000-0000-000000000002: 2501',
      '40000000-0000-0000-0000-000000000001: 2501',
    ])
  );
  await expect(result).toHaveAttribute('data-reads', reads);
  await page.getByRole('button', { name: 'Invalidate coverage' }).click();
  await expect(result).toHaveAttribute('data-status', 'incomplete');
  await expect(groups).toHaveCount(0);
  await page.getByRole('button', { name: 'Complete backfill' }).click();
  await expect(result).toHaveAttribute('data-status', 'complete', {
    timeout: 60_000,
  });
  await expect(result).toHaveAttribute('data-count', '5002');
  await page.getByRole('button', { name: 'Delete last task' }).click();
  await expect(result).toHaveAttribute('data-action', 'deleted');
  await expect(result).toHaveAttribute('data-status', 'incomplete');
  await page.getByRole('button', { name: 'Complete backfill' }).click();
  await expect(result).toHaveAttribute('data-status', 'complete', {
    timeout: 60_000,
  });
  await expect(result).toHaveAttribute('data-count', '5001');
});
