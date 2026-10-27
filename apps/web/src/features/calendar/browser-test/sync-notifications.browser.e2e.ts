import { expect, test } from '@playwright/test';

test('deduplicates retries, remembers dismissal, and clears recovered notices', async ({
  page,
}) => {
  await page.goto('/');
  const notices = page.locator('[data-macro-toast]:visible');
  await expect(notices).toHaveCount(1);
  await expect(notices).toContainText('Check event details');
  await expect(notices).not.toContainText(
    /Tracing spans|private-event|private-account/
  );

  await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await expect(notices).toHaveCount(1);
  await notices.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(notices).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await expect(notices).toHaveCount(0);

  await page.getByRole('button', { name: 'Recover', exact: true }).click();
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await expect(notices).toContainText('Check event details');
  await page
    .getByRole('button', { name: 'Connection issue', exact: true })
    .click();
  await expect(notices).toHaveCount(1);
  await expect(notices).toContainText('Calendar sync paused');
  await expect(notices).not.toContainText('Check event details');
  await page.getByRole('button', { name: 'Recover', exact: true }).click();
  await expect(notices).toHaveCount(0);
});

test('queues calendar warnings in the shared persistent region', async ({
  page,
}) => {
  await page.goto('/');
  const notices = page.locator('[data-macro-toast]:visible');
  await expect(notices).toContainText('Community events');
  await page
    .getByRole('button', { name: 'Second calendar', exact: true })
    .click();
  await expect(notices).toHaveCount(1);
  await notices.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(notices).toHaveCount(1);
  await expect(notices).toContainText('work@example.test');
});

test('shares one notice and dismissal across simultaneous calendar views', async ({
  page,
}) => {
  await page.goto('/');
  const notices = page.locator('[data-macro-toast]:visible');
  await expect(notices).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Open second view', exact: true })
    .click();
  await expect(notices).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Close first view', exact: true })
    .click();
  await expect(notices).toHaveCount(1);
  await notices.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(notices).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Open first view', exact: true })
    .click();
  await expect(notices).toHaveCount(0);
  await page.getByRole('button', { name: 'Recover', exact: true }).click();
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await expect(notices).toHaveCount(1);
  await notices.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(notices).toHaveCount(0);
});

test('retains the notice when a loading view takes over during a failed handoff', async ({
  page,
}) => {
  await page.goto('/');
  const notices = page.locator('[data-macro-toast]:visible');
  await expect(notices).toHaveCount(1);
  const toastId = await notices.getAttribute('data-toast-id');
  await page
    .getByRole('button', { name: 'Lose calendar data', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Open second view', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Close first view', exact: true })
    .click();
  await expect(notices).toHaveCount(1);
  await expect(notices).toHaveAttribute('data-toast-id', toastId!);
  await expect(notices).toContainText('Community events');
  await page.getByRole('button', { name: 'Recover', exact: true }).click();
  await expect(notices).toHaveCount(0);
});

test('scopes retained notices and dismissals to the current viewer', async ({
  page,
}) => {
  await page.goto('/');
  const notices = page.locator('[data-macro-toast]:visible');
  await notices.getByRole('button', { name: 'Close', exact: true }).click();
  await page
    .getByRole('button', { name: 'Lose calendar data', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Change viewer', exact: true })
    .click();
  await expect(notices).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Restore calendar data', exact: true })
    .click();
  await expect(notices).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Lose calendar data', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Change viewer', exact: true })
    .click();
  await expect(notices).toHaveCount(0);
});

test('gives setup actions priority even while query data is unavailable', async ({
  page,
}) => {
  await page.goto('/');
  const notices = page.locator('[data-macro-toast]:visible');
  await expect(notices).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Lose calendar data', exact: true })
    .click();
  await page.getByRole('button', { name: 'Toggle setup', exact: true }).click();
  await expect(notices).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle setup', exact: true }).click();
  await page
    .getByRole('button', { name: 'Restore calendar data', exact: true })
    .click();
  await expect(notices).toHaveCount(1);
});

for (const theme of ['light', 'dark']) {
  test(`wraps long calendar labels without clipping the ${theme} toast`, async ({
    page,
  }, testInfo) => {
    await page.goto(`/?long&theme=${theme}`);
    const toast = page.locator('[data-macro-toast]:visible');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(
      'community-calendar-coordination@example.test'
    );
    await expect(toast).toContainText('Review it in your calendar app.');
    const title = toast.getByText('Check event details', { exact: true });
    const metrics = await title.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight + 1);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);
    const bounds = await toast.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width
    );
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height
    );
    expect(
      // The shared close button intentionally straddles the toast's corner.
      // Check the text block, whose content must remain inside the card.
      await toast
        .locator('.macro-toast-content > .min-w-0')
        .evaluate((element) => element.scrollWidth <= element.clientWidth)
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`calendar-sync-${theme}.png`),
    });
  });
}
