import { expect, type Locator, type Page, test } from '@playwright/test';

const addedImport = (page: Page) =>
  page.locator('[data-line][data-line-type="change-addition"]', {
    hasText: 'import { hasUnreadActivity }',
  });
const keptImport = (page: Page) =>
  page.locator('[data-line][data-line-type="change-addition"]', {
    hasText: 'import type { AgentSessionSummary }',
  });
const commentStart = (page: Page) =>
  page.locator('[data-line][data-line-type="change-addition"]', {
    hasText: 'Archiving takes a session',
  });
const commentEnd = (page: Page) =>
  page.locator('[data-line][data-line-type="change-addition"]', {
    hasText: 'news. The rail has to ask',
  });
const removedImport = (page: Page) =>
  page.locator('[data-line][data-line-type="change-deletion"]', {
    hasText: 'import type { AgentSessionSummary }',
  });

/** Drags a selection from the start of one line to the end of another. */
async function dragAcross(page: Page, from: Locator, to: Locator) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) throw new Error('Diff lines are not on screen');
  await page.mouse.move(start.x + 1, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width - 2, end.y + end.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(addedImport(page)).toBeVisible();
});

test('a selection across diff lines quotes its file and lines', async ({
  page,
}) => {
  await dragAcross(page, commentStart(page), commentEnd(page));
  await page.getByRole('button', { name: 'Reply to this' }).click();
  await expect(page.getByLabel('Quote')).toHaveText(
    [
      '`apps/web/src/components/app/sidebar-next/queries/use-sidebar-unread.ts`, lines 23–24 (new)',
      '',
      '// Archiving takes a session off the inbox, so its activity stops being',
      '  // news. The rail has to ask the same question the agents list asks,',
    ].join('\n')
  );
  await page
    .locator('main')
    .screenshot({ path: test.info().outputPath('diff-quote.png') });
});

test('a triple-clicked diff line quotes that line alone', async ({ page }) => {
  await addedImport(page).click({ clickCount: 3 });
  await page.getByRole('button', { name: 'Reply to this' }).click();
  await expect(page.getByLabel('Quote')).toContainText(
    'use-sidebar-unread.ts`, line 10 (new)'
  );
});

test('a selection from deleted lines into added ones names both sides', async ({
  page,
}) => {
  await dragAcross(page, removedImport(page), keptImport(page));
  await page.getByRole('button', { name: 'Reply to this' }).click();
  await expect(page.getByLabel('Quote')).toContainText(
    'use-sidebar-unread.ts`, line 10 (old) to line 11 (new)'
  );
});

test('transcript text outside a diff quotes as it is', async ({ page }) => {
  await page.locator('[data-transcript]').click({ clickCount: 3 });
  await page.getByRole('button', { name: 'Reply to this' }).click();
  await expect(page.getByLabel('Quote')).toHaveText(
    'The cart total now comes from one helper.'
  );
});
