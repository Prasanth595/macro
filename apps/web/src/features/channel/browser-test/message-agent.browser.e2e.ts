import { expect, test } from '@playwright/test';

for (const reply of [false, true]) {
  test(`opens an editable agent draft from a ${reply ? 'reply' : 'root message'}`, async ({
    page,
    isMobile,
  }) => {
    // Synthetic messages only; no hosted dev data is read or changed.
    await page.route('**/*', async (route) => {
      if (new URL(route.request().url()).hostname === 'localhost') {
        await route.continue();
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: '{}',
        });
      }
    });
    await page.routeWebSocket('**/*', (socket) => socket.close());
    await page.goto(reply ? '/?reply' : '/');
    const message = page.locator('[data-message-id="fixture-message"]');
    await expect(message).toBeVisible({ timeout: 30_000 });
    if (isMobile) {
      const box = await message.boundingBox();
      if (!box) throw new Error('Message has no bounds');
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
      });
      await expect(
        page.getByRole('button', { name: 'Ask Macro', exact: true })
      ).toBeVisible();
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await page
        .getByRole('button', { name: 'Ask Macro', exact: true })
        .click();
    } else {
      await message.hover();
      await page
        .getByRole('button', { name: 'Chat with Agent', exact: true })
        .click();
    }
    const draft = page.getByRole('region', { name: 'New agent session' });
    const editor = draft.locator('[data-markdown-editable]');
    await expect(editor).toContainText('Figure out and implement this');
    await expect(editor).toContainText('Fix the layout for narrow screens.');
    await draft
      .getByText('Figure out and implement this', { exact: true })
      .click();
    await page.keyboard.press('End');
    await page.keyboard.type(' please');
    await expect(editor).toContainText('Figure out and implement this please');
    await expect(message).toBeVisible();
  });
}
