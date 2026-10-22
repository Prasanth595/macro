import { expect, test } from '@playwright/test';

test.use({ video: 'on' });

test('retired editors stop observing input modality after repeated navigation', async ({
  page,
}) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (
      url.hostname === 'localhost' &&
      !url.pathname.includes('/__macro_dev/')
    ) {
      await route.continue();
    } else {
      await route.fulfill({ status: 401, body: '{}' });
    }
  });
  await page.routeWebSocket('**/*', (socket) => socket.close());
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    '/src/lib/core/component/LexicalMarkdown/component/core/browser-test/memory.html'
  );
  for (let cycle = 1; cycle <= 20; cycle += 1) {
    await page
      .getByRole('button', { name: 'Open editor', exact: true })
      .click();
    await expect(page.getByTestId('connections')).toHaveText(String(cycle));
    const editor = page.getByRole('textbox', { name: 'Test message' });
    await expect(editor).toContainText('Draft body');
    await editor.fill('Typing still works');
    await expect(editor).toHaveText('Typing still works');
    await page
      .getByRole('button', { name: 'Close editor', exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    await page.getByRole('button', { name: 'Change input modality' }).click();
    await expect(page.getByTestId('retired-reads')).toHaveText('0');
  }
  expect(errors).toEqual([]);
});
