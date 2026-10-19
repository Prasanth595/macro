import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = process.env.CALENDAR_BROWSER_CDP
  ? await chromium.connectOverCDP(process.env.CALENDAR_BROWSER_CDP)
  : await chromium.launch({ headless: true });
const base = process.env.CALENDAR_PREVIEW_URL ?? 'https://localhost:3000';
const fixture = `${base}/src/features/calendar-view/browser-test/index.html`;
const results = [];

async function verifyDesktop(options, name) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, ...options });
  try {
    await context.route('**/__macro_dev/**', (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', (error) => { errors.push(error.message); console.error(error.stack); });
    await page.goto(fixture);
    await page.getByRole('button', { name: 'Select 10 AM', exact: true }).click();
    const title = page.getByLabel('Title', { exact: true });
    await title.waitFor();
    assert.equal(await title.evaluate((element) => element === document.activeElement), true);
    await title.fill('Calendar draft stays here');
    await page.getByLabel('Description', { exact: true }).fill('Keep this description when moving.');

    await page.getByRole('button', { name: /Video conferencing/ }).click();
    await page.getByRole('option', { name: 'Google Meet', exact: true }).click();
    await page.getByRole('button', { name: 'Location', exact: true }).click();
    await page.getByRole('textbox', { name: 'Location', exact: true }).fill('Design studio');
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: 'Location', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await title.inputValue(), 'Calendar draft stays here');

    await page.getByRole('button', { name: 'Guests', exact: true }).click();
    await page.getByText('Ada Lovelace', { exact: false }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Repeats/ }).click();
    await page.getByRole('option', { name: /Custom/ }).click();
    await page.getByRole('spinbutton', { name: 'Repeat interval', exact: true }).fill('2');
    assert.equal(await title.isVisible(), true);
    await page.getByRole('button', { name: 'Edit event start date and time', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await title.isVisible(), true);

    await page.getByRole('button', { name: 'Next week', exact: true }).click();
    await page.locator('.fc-scroller').evaluateAll((elements) => {
      for (const element of elements) element.scrollTop = element.scrollHeight;
    });
    await page.getByRole('button', { name: 'Change period', exact: true }).click();
    assert.equal(await title.inputValue(), 'Calendar draft stays here');
    await page.screenshot({ path: `/tmp/calendar-creation-${name}-popover.png` });

    await page.getByRole('button', { name: 'Move to sidebar', exact: true }).click();
    assert.equal(await title.inputValue(), 'Calendar draft stays here');
    assert.equal(await page.getByRole('spinbutton', { name: 'Repeat interval', exact: true }).inputValue(), '2');
    assert.match(await page.getByRole('button', { name: 'Guests', exact: true }).innerText(), /Ada Lovelace/);
    assert.match(await page.getByLabel('Description', { exact: true }).innerText(), /Keep this description/);
    assert.equal(await page.getByRole('button', { name: 'Move to sidebar', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Location', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Location', exact: true }).inputValue(), 'Design studio');
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: 'Location', exact: true }).waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Next week', exact: true }).click();
    assert.equal(await title.isVisible(), true);
    await page.screenshot({ path: `/tmp/calendar-creation-${name}-sidebar.png` });

    await page.getByRole('button', { name: 'Close event editor', exact: true }).click();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    assert.equal(await title.inputValue(), 'Calendar draft stays here');
    await page.getByRole('button', { name: 'Close event editor', exact: true }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Create event', exact: true }).click();
    await title.waitFor();
    assert.equal(await page.getByRole('button', { name: 'Move to sidebar', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
    results.push(`${name}: persistent popover, sidebar transfer, menus, and discard protection passed`);
  } finally {
    await context.close();
  }
}

async function verifyMobile() {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    await context.route('**/__macro_dev/**', (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', (error) => { errors.push(error.message); console.error(error.stack); });
    await page.goto(fixture);
    await page.getByRole('button', { name: 'Create event', exact: true }).click();
    const title = page.getByLabel('Title', { exact: true });
    await title.waitFor();
    assert.equal(await title.evaluate((element) => element === document.activeElement), false);
    assert.equal(await page.getByRole('button', { name: 'Move to sidebar', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Close event editor', exact: true }).count(), 0);
    await title.fill('Phone draft');
    await page.getByLabel('Description', { exact: true }).fill('Phone description');
    await page.locator('[data-corvu-drawer-content][data-transitioning]').waitFor({ state: 'detached' });
    await page.screenshot({ path: '/tmp/calendar-creation-phone.png' });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).waitFor({ state: 'detached' });
    assert.equal(await title.inputValue(), 'Phone draft');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
    results.push('phone: full-height sheet, touch layout, and discard protection passed');
  } finally {
    await context.close();
  }
}

async function verifyGridSelection() {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  try {
    await context.route('**/__macro_dev/**', (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', (error) => { errors.push(error.message); console.error(error.stack); });
    await page.goto(fixture);
    const slot = page.locator('.fc-timegrid-slot[data-time="10:00:00"]').first();
    await slot.scrollIntoViewIfNeeded();
    const row = await slot.boundingBox();
    const column = await page.locator('.fc-timegrid-col[data-date]').nth(2).boundingBox();
    assert.ok(row && column);
    const x = column.x + column.width / 2;
    const y = row.y + row.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + row.height * 3, { steps: 12 });
    await page.mouse.up();
    const title = page.getByLabel('Title', { exact: true });
    await title.waitFor();
    await title.fill('Dragged draft');
    const start = page.getByRole('button', { name: 'Edit event start date and time', exact: true });
    const initialStart = await start.innerText();
    await page.mouse.click(column.x + column.width / 2, row.y + row.height * 6);
    assert.equal(await title.inputValue(), 'Dragged draft');
    assert.equal(await start.innerText(), initialStart);
    await page.getByRole('button', { name: 'Next week', exact: true }).click();
    assert.equal(await title.inputValue(), 'Dragged draft');
    await page.getByRole('button', { name: 'Close event editor', exact: true }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Change period', exact: true }).click();
    const day = page.locator('.fc-daygrid-day-frame').nth(10);
    await day.click({ position: { x: 20, y: 45 } });
    await title.waitFor();
    assert.equal(await page.getByRole('switch', { name: 'All day', exact: true }).isChecked(), true);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
    results.push('grid: timed drag, ignored replacement selection, navigation, and Month creation passed');
  } finally {
    await context.close();
  }
}

try {
  await verifyGridSelection();
  await verifyDesktop({ viewport: { width: 1440, height: 1000 } }, 'desktop');
  await verifyDesktop({ viewport: { width: 1024, height: 900 }, hasTouch: true }, 'tablet');
  await verifyMobile();
  console.log(results.join('\n'));
} finally {
  await browser.close();
}
