import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = process.env.CALENDAR_BROWSER_CDP
  ? await chromium.connectOverCDP(process.env.CALENDAR_BROWSER_CDP)
  : await chromium.launch({ headless: true });
const base = process.env.CALENDAR_PREVIEW_URL ?? 'https://localhost:3000';
const fixture = `${base}/src/features/calendar-view/browser-test/index.html`;
const results = [];

async function verifyFieldSpacing(page) {
  const gaps = await page.locator('form [role="group"][aria-label]').evaluateAll((elements) => {
    const rows = elements.filter((element) => element.getAttribute('aria-label') !== 'Event type').map((element) => element.getBoundingClientRect());
    return rows.slice(1).map((row, index) => row.top - rows[index].bottom);
  });
  assert.ok(gaps.length >= 5);
  assert.ok(gaps[0] > 0);
  assert.ok(gaps.every((gap) => Math.abs(gap - gaps[0]) < 1), `Uneven row spacing: ${gaps}`);
}

async function verifySelectorShape(page) {
  const selectors = await page.locator('form button[aria-expanded]').evaluateAll((elements) => elements.map((element) => {
    const column = element.closest('[role="group"][aria-label]')?.lastElementChild;
    const style = getComputedStyle(element);
    return {
      label: element.getAttribute('aria-label'),
      width: element.getBoundingClientRect().width,
      available: column?.getBoundingClientRect().width,
      radii: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius].map(Number.parseFloat),
    };
  }));
  assert.ok(selectors.length >= 5);
  for (const selector of selectors) {
    assert.ok(selector.radii.every((radius) => radius === 0), `${selector.label} must have square corners`);
    assert.ok(Math.abs(selector.width - selector.available) < 1, `${selector.label} must fill its value column`);
  }
}

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
    const start = page.getByRole('button', { name: 'Edit event start date and time', exact: true });
    await title.waitFor();
    assert.equal(await title.evaluate((element) => element === document.activeElement), true);
    assert.equal(await start.count(), 0);
    const rowLabels = await page.locator('form [role="group"][aria-label]').evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')));
    assert.deepEqual(rowLabels, ['Event type', 'Repeats', 'Meeting link', 'Location', 'Description', 'Notifications', 'Calendar', 'Guests']);
    await verifyFieldSpacing(page);
    await verifySelectorShape(page);
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
    for (const name of ['Event type', 'Calendar', 'Guests', 'Meeting link', 'Notifications']) {
      assert.equal(await page.getByRole('group', { name, exact: true }).getByRole('button').count(), 0, `${name} must render as read-only content`);
    }
    await title.fill('Revised design review');
    await page.getByRole('textbox', { name: 'Location', exact: true }).fill('North studio');
    await page.getByText('This event', { exact: true }).click();
    assert.equal(await page.getByRole('group', { name: 'Repeats', exact: true }).getByRole('button').count(), 0);
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
    await page.getByRole('button', { name: 'Edit example event', exact: true }).click();
    await title.waitFor();
    await page.getByRole('button', { name: /Repeats/ }).click();
    await page.getByRole('option', { name: 'Daily', exact: true }).click();
    assert.equal(await page.getByRole('radio', { name: 'This event', exact: true }).isDisabled(), true);
    await page.getByText('Repeat changes apply to all events.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Move to sidebar', exact: true }).click();
    assert.equal(await page.getByRole('radio', { name: 'This event', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    const repeated = JSON.parse(await page.getByLabel('Saved event', { exact: true }).innerText());
    assert.equal(repeated.scope, 'all');
    assert.match(repeated.values.recurrenceLines.join(';'), /FREQ=DAILY/);
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
    page.setDefaultTimeout(60000);
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
    await verifyFieldSpacing(page);
    await verifySelectorShape(page);
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
    // A clean drag draft is replaced by a calendar click without confirmation.
    const clickRow = await page.locator('.fc-timegrid-slot[data-time="12:00:00"]').first().boundingBox();
    const clickColumn = await page.locator('.fc-timegrid-col[data-date]').first().boundingBox();
    assert.ok(clickRow && clickColumn);
    await page.mouse.click(clickColumn.x + clickColumn.width / 2, clickRow.y + clickRow.height / 2);
    assert.equal(await page.getByRole('button', { name: 'Discard', exact: true }).count(), 0);
    assert.ok(await page.locator('.fc-highlight, .fc-event-mirror').count() > 0, 'replacement keeps its calendar selection highlight');
    await page.getByRole('button', { name: 'Move to sidebar', exact: true }).click();
    const start = page.getByRole('button', { name: 'Edit event start date and time', exact: true });
    assert.match(await start.innerText(), /12:00/);
    await title.fill('Dragged draft');

    // Keep editing cancels a new click without changing the original draft.
    const dirtyRow = await page.locator('.fc-timegrid-slot[data-time="14:00:00"]').first().boundingBox();
    const dirtyColumn = await page.locator('.fc-timegrid-col[data-date]').first().boundingBox();
    assert.ok(dirtyRow && dirtyColumn);
    await page.mouse.click(dirtyColumn.x + dirtyColumn.width / 2, dirtyRow.y + dirtyRow.height / 2);
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    assert.equal(await title.inputValue(), 'Dragged draft');
    assert.match(await start.innerText(), /12:00/);

    // Discard applies the newly dragged range, rather than simply closing.
    const dragRow = await page.locator('.fc-timegrid-slot[data-time="15:00:00"]').first().boundingBox();
    assert.ok(dragRow);
    const dragX = dirtyColumn.x + dirtyColumn.width / 2;
    const dragY = dragRow.y + dragRow.height / 2;
    await page.mouse.move(dragX, dragY);
    await page.mouse.down();
    await page.mouse.move(dragX, dragY + dragRow.height * 2, { steps: 8 });
    await page.mouse.up();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    assert.equal(await title.inputValue(), '');
    await page.getByRole('button', { name: 'Move to sidebar', exact: true }).click();
    assert.match(await start.innerText(), /3:00 PM/);
    await title.fill('Dragged draft');
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
    results.push('grid: timed drag, clean replacement, Keep editing, Discard replacement, navigation, and Month creation passed');
  } finally {
    await context.close();
  }
}

try {
  await verifyGridSelection();
  if (!process.argv.includes('--grid-only')) {
    await verifyDesktop({ viewport: { width: 1440, height: 1000 } }, 'desktop');
    await verifyDesktop({ viewport: { width: 1024, height: 900 }, hasTouch: true }, 'tablet');
    await verifyMobile();
  }
  console.log(results.join('\n'));
} finally {
  await browser.close();
}
