import { expect, test } from '@playwright/test';

/** `--mobile-chrome-gutter` from the right edge, and the gap above the composer. */
const gutter = 12;
const buttonSize = 46;

for (const platform of ['ios', 'android']) {
  test(`jump to latest floats bottom-right above the composer on ${platform}`, async ({
    page,
  }) => {
    await page.goto(
      `/src/features/channel/Channel/browser-test/jump-to-latest.html?platform=${platform}`
    );
    const button = page.getByRole('button', { name: 'Jump to latest' });
    await expect(button).toBeVisible({ timeout: 30_000 });

    const viewport = page.viewportSize();
    const box = await button.boundingBox();
    const composer = await page.getByTestId('composer').boundingBox();
    if (!viewport || !box || !composer) throw new Error('Fixture not laid out');
    expect(box.width).toBeCloseTo(buttonSize, 0);
    expect(box.height).toBeCloseTo(buttonSize, 0);
    expect(box.x + box.width).toBeCloseTo(viewport.width - gutter, 0);
    expect(box.y + box.height).toBeCloseTo(composer.y - gutter, 0);

    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByLabel('Jumps')).toHaveText('smooth');
  });
}
