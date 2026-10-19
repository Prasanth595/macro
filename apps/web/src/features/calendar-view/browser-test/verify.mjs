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
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', (error) => { errors.push(error.message); console.error(error.stack); });
    await page.goto(fixture);
    await page.getByRole('button', { name: 'Select 10 AM', exact: true }).click();
    const title = page.getByLabel('Title', { exact: true });
    const start = page.getByRole('button', { name: 'Edit event start date and time', exact: true });
    await title.waitFor();
    assert.equal(await title.evaluate((element) => element === document.activeElement), true);
    assert.equal(await start.count(), 0);
    await title.fill('Calendar draft stays here');
    await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Keep this description when moving.');
    await page.getByRole('button', { name: /Video conferencing/ }).click();
    await page.getByRole('option', { name: 'Google Meet', exact: true }).click();
    await page.getByRole('textbox', { name: 'Location', exact: true }).fill('Design studio');
    await page.getByRole('button', { name: 'Guests', exact: true }).click();
    await page.getByText('Ada Lovelace', { exact: false }).click();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /Repeats/ }).click();
    await page.getByRole('option', { name: /Custom/ }).click();
    const recurrence = page.getByRole('dialog', { name: 'Custom recurrence', exact: true });
    await recurrence.getByRole('spinbutton', { name: 'Repeat interval', exact: true }).fill('3');
    await recurrence.getByRole('button', { name: 'Cancel', exact: true }).click();
    await recurrence.waitFor({ state: 'detached' });
    assert.match(await page.getByRole('button', { name: /Repeats/ }).innerText(), /Does not repeat/);
    await page.getByRole('button', { name: /Repeats/ }).click();
    await page.getByRole('option', { name: /Custom/ }).click();
    const interval = recurrence.getByRole('spinbutton', { name: 'Repeat interval', exact: true });
    assert.equal(await interval.inputValue(), '1');
    await interval.fill('0');
    assert.equal(await recurrence.getByRole('button', { name: 'Done', exact: true }).isDisabled(), true);
    await interval.fill('2');
    await recurrence.getByRole('button', { name: 'Done', exact: true }).click();
    await recurrence.waitFor({ state: 'detached' });

    await page.getByRole('button', { name: 'Next week', exact: true }).click();
    await page.locator('.fc-scroller').evaluateAll((elements) => {
      for (const element of elements) element.scrollTop = element.scrollHeight;
    });
    await page.getByRole('button', { name: 'Change period', exact: true }).click();
    assert.equal(await title.inputValue(), 'Calendar draft stays here');
    await page.screenshot({ path: `/tmp/calendar-editor-${name}-popover.png` });

    await page.getByRole('button', { name: 'Move to sidebar', exact: true }).click();
    assert.equal(await title.inputValue(), 'Calendar draft stays here');
    assert.match(await page.getByRole('button', { name: 'Guests', exact: true }).innerText(), /Ada Lovelace/);
    assert.match(await page.getByRole('textbox', { name: 'Description', exact: true }).innerText(), /Keep this description/);
    assert.equal(await page.getByRole('textbox', { name: 'Location', exact: true }).inputValue(), 'Design studio');
    assert.equal(await page.getByRole('button', { name: 'Move to sidebar', exact: true }).count(), 0);
    await start.click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Edit custom rule/ }).click();
    assert.equal(await interval.inputValue(), '2');
    await interval.fill('4');
    await page.keyboard.press('Escape');
    await recurrence.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: /Edit custom rule/ }).click();
    assert.equal(await interval.inputValue(), '2');
    await recurrence.getByRole('button', { name: 'Done', exact: true }).click();
    await recurrence.waitFor({ state: 'detached' });
    await page.screenshot({ path: `/tmp/calendar-editor-${name}-sidebar.png` });

    await page.getByRole('button', { name: 'Close event editor', exact: true }).click();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    assert.equal(await title.inputValue(), 'Calendar draft stays here');
    await page.getByRole('button', { name: 'Close event editor', exact: true }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Create event', exact: true }).click();
    await title.waitFor();
    await start.waitFor();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await title.waitFor({ state: 'detached' });

    await page.getByRole('button', { name: 'Edit example event', exact: true }).click();
    await title.waitFor();
    assert.equal(await title.inputValue(), 'Weekly design review');
    assert.equal(await start.count(), 0);
    assert.match(await page.getByRole('textbox', { name: 'Description', exact: true }).innerText(), /Existing agenda/);
    assert.equal(await page.getByRole('textbox', { name: 'Location', exact: true }).inputValue(), 'Design studio');
    await title.fill('Revised design review');
    await page.getByRole('textbox', { name: 'Location', exact: true }).fill('North studio');
    await page.getByText('This event', { exact: true }).click();
    await page.screenshot({ path: `/tmp/calendar-editor-${name}-edit.png` });
    await page.getByRole('button', { name: 'Move to sidebar', exact: true }).click();
    assert.equal(await title.inputValue(), 'Revised design review');
    await start.waitFor();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    const submitted = JSON.parse(await page.getByLabel('Saved event', { exact: true }).innerText());
    assert.equal(submitted.values.title, 'Revised design review');
    assert.equal(submitted.values.location, 'North studio');
    assert.equal(submitted.scope, 'this_event');
    assert.equal(submitted.values.time.kind, 'timed');
    assert.equal(Date.parse(submitted.values.time.endsAt) - Date.parse(submitted.values.time.startsAt), 3600000);
    assert.deepEqual(errors, []);
    results.push(`${name}: creation, persistent surfaces, transactional recurrence, editing, and scoped save passed`);
  } finally {
    await context.close();
  }
}

async function verifyMobile() {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    await context.route('**/__macro_dev/**', (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', (error) => { errors.push(error.message); console.error(error.stack); });
    await page.goto(fixture);
    await page.getByRole('button', { name: 'Create event', exact: true }).click();
    const title = page.getByLabel('Title', { exact: true });
    await title.waitFor();
    assert.equal(await title.evaluate((element) => element === document.activeElement), false);
    await page.getByRole('button', { name: 'Edit event start date and time', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Move to sidebar', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Close event editor', exact: true }).count(), 0);
    await title.fill('Phone draft');
    await page.getByRole('textbox', { name: 'Location', exact: true }).fill('South studio');
    await page.getByRole('button', { name: /Repeats/ }).click();
    await page.getByRole('option', { name: /Custom/ }).click();
    const recurrence = page.getByRole('dialog', { name: 'Custom recurrence', exact: true });
    await recurrence.getByRole('spinbutton', { name: 'Repeat interval', exact: true }).fill('2');
    await recurrence.getByRole('button', { name: 'Done', exact: true }).click();
    await recurrence.waitFor({ state: 'detached' });
    assert.equal(await title.inputValue(), 'Phone draft');
    await page.locator('[data-corvu-drawer-content][data-transitioning]').waitFor({ state: 'detached' });
    await page.screenshot({ path: '/tmp/calendar-editor-phone.png' });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).waitFor({ state: 'detached' });
    assert.equal(await title.inputValue(), 'Phone draft');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Edit example event', exact: true }).click();
    await title.waitFor();
    assert.equal(await title.inputValue(), 'Weekly design review');
    await page.getByRole('button', { name: 'Edit event start date and time', exact: true }).waitFor();
    await page.getByRole('textbox', { name: 'Location', exact: true }).fill('Phone studio');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    const submitted = JSON.parse(await page.getByLabel('Saved event', { exact: true }).innerText());
    assert.equal(submitted.values.location, 'Phone studio');
    assert.equal(submitted.scope, 'all');
    assert.deepEqual(errors, []);
    results.push('phone: full-height create/edit sheet, date controls, recurrence dialog, and discard protection passed');
  } finally {
    await context.close();
  }
}

async function verifyGridSelection() {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  try {
    await context.route('**/__macro_dev/**', (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
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
    await page.mouse.click(column.x + column.width / 2, row.y + row.height * 6);
    assert.equal(await title.inputValue(), 'Dragged draft');
    await page.getByRole('button', { name: 'Move to sidebar', exact: true }).click();
    const start = page.getByRole('button', { name: 'Edit event start date and time', exact: true });
    assert.match(await start.innerText(), /10:00/);
    await page.getByRole('button', { name: 'Next week', exact: true }).click();
    assert.equal(await title.inputValue(), 'Dragged draft');
    await page.getByRole('button', { name: 'Close event editor', exact: true }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Change period', exact: true }).click();
    const day = page.locator('.fc-daygrid-day-frame').nth(10);
    await day.click({ position: { x: 20, y: 45 } });
    await title.waitFor();
    await page.getByRole('button', { name: 'Move to sidebar', exact: true }).click();
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
