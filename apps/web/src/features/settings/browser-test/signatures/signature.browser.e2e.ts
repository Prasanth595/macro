import { expect, test } from '@playwright/test';
import { signatureHtml } from './sample';
import type {} from './services';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('region', { name: 'Signature preview for alex@example.com' })
  ).toBeVisible();
});

test('saved HTML keeps its nested layout in settings and new-message previews', async ({
  page,
}) => {
  const preview = page.getByRole('region', {
    name: 'Signature preview for alex@example.com',
  });
  await expect(preview.locator('table')).toHaveCount(3);
  await expect(preview.locator('table table')).toHaveCount(2);
  await expect(preview.locator('td').first()).toHaveCSS(
    'border-top-width',
    '0px'
  );
  const name = preview.getByText('Alex Morgan');
  const title = preview.getByText('Brand and Marketing Strategist');
  const nameBox = await name.boundingBox();
  const titleBox = await title.boundingBox();
  expect(nameBox && titleBox && nameBox.y < titleBox.y).toBeTruthy();
  await page.getByRole('button', { name: 'Signature', exact: true }).click();
  const outgoing = page.getByRole('region', {
    name: 'Signature preview',
    exact: true,
  });
  await expect(outgoing.locator('table')).toHaveCount(3);
  expect(
    await outgoing.evaluate((element) => element.shadowRoot?.innerHTML)
  ).toBe(await preview.evaluate((element) => element.shadowRoot?.innerHTML));
  await page.getByRole('button', { name: 'Leave settings' }).click();
  await page.getByRole('button', { name: 'Reopen settings' }).click();
  await expect(preview.locator('table')).toHaveCount(3);
  expect(
    await page.evaluate(() => window.signatureFixture.readState().patches)
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
});

test('import, HTML edits, save, and reopening preserve the future signature', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Signature editing is desktop-only');
  await page.getByRole('button', { name: 'Import from Gmail' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Signature imported from Gmail'
  );
  expect(
    await page.evaluate(
      () => window.signatureFixture.readState().savedSignature
    )
  ).toBe(signatureHtml);
  await page.getByRole('tab', { name: 'HTML', exact: true }).click();
  const html = page.getByRole('textbox', {
    name: 'Signature HTML for alex@example.com',
  });
  await expect(html).toHaveValue(signatureHtml);
  const edited = signatureHtml.replace('Alex Morgan', 'Alex Morgan · Updated');
  await html.fill(edited);
  await page.getByRole('tab', { name: 'Preview', exact: true }).click();
  await expect(
    page.getByText('Alex Morgan · Updated', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save signature' }).click();
  await expect(page.getByRole('status')).toHaveText('Signature saved');
  expect(
    await page.evaluate(() => window.signatureFixture.readState().patches)
  ).toEqual([{ signature: edited }]);
  await page.getByRole('button', { name: 'Signature', exact: true }).click();
  const outgoing = page.getByRole('region', {
    name: 'Signature preview',
    exact: true,
  });
  await expect(outgoing.getByText('Alex Morgan · Updated')).toBeVisible();
  await expect(outgoing.locator('table table')).toHaveCount(2);
  await page.getByRole('button', { name: 'Leave settings' }).click();
  await page.getByRole('button', { name: 'Reopen settings' }).click();
  await page.getByRole('tab', { name: 'HTML', exact: true }).click();
  await expect(html).toHaveValue(
    await page.evaluate(
      () => window.signatureFixture.readState().savedSignature ?? ''
    )
  );
  await expect(
    page.getByRole('button', { name: 'Save signature' })
  ).toBeDisabled();
});

test('rich text conversion requires consent and cancel leaves HTML untouched', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Signature editing is desktop-only');
  await page.getByRole('tab', { name: 'Rich text' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Signature preview for alex@example.com' })
      .locator('table table')
  ).toHaveCount(2);
  expect(
    await page.evaluate(() => window.signatureFixture.readState().patches)
  ).toEqual([]);
  await page.getByRole('tab', { name: 'Rich text' }).click();
  await page.getByRole('button', { name: 'Continue to rich text' }).click();
  await expect(
    page.getByRole('textbox', { name: 'Signature for alex@example.com' })
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Preview', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Signature preview for alex@example.com' })
      .locator('table table')
  ).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'Save signature' })
  ).toBeDisabled();
});

test('pasting a custom signature bypasses Quill conversion', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Signature editing is desktop-only');
  await page.getByRole('button', { name: 'Clear signature' }).click();
  await expect(page.getByRole('status')).toHaveText('Signature removed');
  await page.getByRole('tab', { name: 'Rich text' }).click();
  const editor = page.getByRole('textbox', {
    name: 'Signature for alex@example.com',
  });
  await editor.click();
  await editor.evaluate((element, html) => {
    const data = new DataTransfer();
    data.setData('text/html', html);
    data.setData('text/plain', 'Alex Morgan');
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      })
    );
  }, signatureHtml);
  const preview = page.getByRole('region', {
    name: 'Signature preview for alex@example.com',
  });
  await expect(preview.locator('table table')).toHaveCount(2);
  await page.getByRole('button', { name: 'Save signature' }).click();
  await expect(page.getByRole('status')).toHaveText('Signature saved');
  expect(
    await page.evaluate(() =>
      window.signatureFixture.readState().patches.at(-1)
    )
  ).toEqual({ signature: signatureHtml });
});

test('text styling that Quill drops is kept as HTML when pasted', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Signature editing is desktop-only');
  await page.getByRole('button', { name: 'Clear signature' }).click();
  await expect(page.getByRole('status')).toHaveText('Signature removed');
  await page.getByRole('tab', { name: 'Rich text' }).click();
  const editor = page.getByRole('textbox', {
    name: 'Signature for alex@example.com',
  });
  await editor.click();
  const html =
    '<p style="text-align:center;font-weight:500">Centered signature</p>';
  await editor.evaluate((element, html) => {
    const data = new DataTransfer();
    data.setData('text/html', html);
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      })
    );
  }, html);
  const signature = page
    .getByRole('region', { name: 'Signature preview for alex@example.com' })
    .getByText('Centered signature');
  await expect(signature).toHaveCSS('text-align', 'center');
  await expect(signature).toHaveCSS('font-weight', '500');
  await page.getByRole('tab', { name: 'Rich text' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Save signature' }).click();
  await expect(page.getByRole('status')).toHaveText('Signature saved');
  expect(
    await page.evaluate(() =>
      window.signatureFixture.readState().patches.at(-1)
    )
  ).toEqual({ signature: html });
});

test('draft previews strip active markup and isolate signature styles', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Signature editing is desktop-only');
  await page.getByRole('tab', { name: 'HTML', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Signature HTML for alex@example.com' })
    .fill(
      '<style>body {display:none} :host {display:none}</style><p onclick="window.alert(1)">Safe signature</p><img src="x" onerror="window.alert(1)"><script>window.alert(1)</script><a href="javascript:alert(1)">Link</a><iframe srcdoc="bad"></iframe>'
    );
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page.getByRole('tab', { name: 'Preview', exact: true }).click();
  const preview = page.getByRole('region', {
    name: 'Signature preview for alex@example.com',
  });
  await expect(preview.getByText('Safe signature')).toBeVisible();
  await expect(
    preview.locator('script,iframe,[onclick],[onerror],a[href^="javascript:"]')
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Save signature' })
  ).toBeVisible();
  expect(dialogs).toEqual([]);
});
