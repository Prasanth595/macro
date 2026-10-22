import { expect, test } from '@playwright/test';

test('an agent routine link renders as a clickable mention', async ({
  page,
}) => {
  await page.goto(
    '/src/lib/core/component/LexicalMarkdown/component/decorator/browser-test/routine-mention.html'
  );
  const mention = page.getByRole('link', { name: 'Daily review' });
  await expect(mention).toBeVisible();
  await expect(mention.locator('[data-block-name="routine"]')).toHaveAttribute(
    'data-document-id',
    '0195ceb6-ec2e-7023-80e4-6e084fa6cccd'
  );
  await mention.click();
  await expect(page.getByLabel('Opened split')).toContainText(
    '"type":"routine"'
  );
  await expect(page.getByLabel('Opened split')).toContainText(
    '"id":"0195ceb6-ec2e-7023-80e4-6e084fa6cccd"'
  );
});
