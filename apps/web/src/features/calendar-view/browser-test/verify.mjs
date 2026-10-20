import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = process.env.CALENDAR_BROWSER_CDP
  ? await chromium.connectOverCDP(process.env.CALENDAR_BROWSER_CDP)
  : await chromium.launch({ headless: true, executablePath: process.env.CALENDAR_BROWSER_EXECUTABLE });
const base = process.env.CALENDAR_PREVIEW_URL ?? 'https://localhost:3000';
const fixture = `${base}/src/features/calendar-view/browser-test/index.html`;
const results = [];

async function verifyFieldSpacing(page) {
  const gaps = await page.locator('form [role="group"][aria-label]').evaluateAll((elements) => {
    const rows = elements.filter((element) => element.getAttribute('aria-label') !== 'Event type').map((element) => element.getBoundingClientRect());
    return rows.slice(1).map((row, index) => row.top - rows[index].bottom);
  });
  assert.ok(gaps.length >= 5);
  const expectedGap = await page.evaluate(() => matchMedia('(min-width: 640px)').matches ? 8 : 12);
  assert.equal(gaps[0], expectedGap, 'Field spacing must stay compact');
  assert.ok(gaps.every((gap) => Math.abs(gap - gaps[0]) < 1), `Uneven row spacing: ${gaps}`);
}

async function verifyDescriptionPosition(page) {
  const directlyUnderTitle = await page.getByRole('group', { name: 'Description', exact: true }).evaluate((element) =>
    Boolean(element.previousElementSibling?.querySelector('[aria-label="Title"]'))
  );
  assert.equal(directlyUnderTitle, true, 'Description must sit directly below the title');
  const alignment = await page.getByRole('group', { name: 'Description', exact: true }).evaluate((row) => {
    const title = document.querySelector('[aria-label="Title"]');
    const container = row.lastElementChild.firstElementChild;
    const textStart = (element) => {
      const style = getComputedStyle(element);
      return element.getBoundingClientRect().x + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft);
    };
    return {
      titleOffset: Math.abs(textStart(title) - textStart(container)),
      titleGap: Number.parseFloat(getComputedStyle(title.parentElement).columnGap),
      rowGaps: Array.from(document.querySelectorAll('form [role="group"][aria-label]'), (element) => Number.parseFloat(getComputedStyle(element).columnGap)),
    };
  });
  assert.ok(alignment.titleOffset < 1, `Title text must align with field text; offset: ${alignment.titleOffset}px`);
  assert.equal(alignment.titleGap, 8, 'Title icon-to-value gap must be compact');
  assert.ok(alignment.rowGaps.every((gap) => gap === 8), 'Property icon-to-value gaps must be compact');
}

async function verifySidebarSurface(page) {
  const surface = await page.locator('aside[role="dialog"]').evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    const parent = element.offsetParent;
    const boundary = parent.getBoundingClientRect();
    const reference = document.createElement('div');
    reference.style.backgroundColor = 'var(--color-surface-3)';
    element.append(reference);
    const raisedColor = getComputedStyle(reference).backgroundColor;
    reference.remove();
    return {
      background: style.backgroundColor,
      raisedColor,
      radii: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius].map(Number.parseFloat),
      insets: [box.top - boundary.top - parent.clientTop, boundary.left + parent.clientLeft + parent.clientWidth - box.right, boundary.top + parent.clientTop + parent.clientHeight - box.bottom, Number.parseFloat(style.marginLeft)],
    };
  });
  assert.equal(surface.background, surface.raisedColor, 'Sidebar must use a raised surface background');
  assert.ok(surface.radii.every((radius) => radius >= 12), 'Sidebar must have rounded corners');
  assert.ok(surface.insets.every((inset) => Math.abs(inset - 12) < 1), `Sidebar must have 12px space around every side: ${surface.insets}`);
}

async function verifyCalendarColors(page) {
  const titleSwatch = page.getByLabel('Title', { exact: true }).locator('..').locator('[aria-hidden="true"] > span');
  const calendar = page.getByRole('button', { name: /^Calendar / });
  const expected = [['Personal', 'rgb(66, 133, 244)'], ['Work', 'rgb(156, 39, 176)']];
  const colorOf = (locator) => locator.evaluate((element) => getComputedStyle(element).backgroundColor);
  assert.equal(await colorOf(titleSwatch), expected[0][1]);
  await calendar.click();
  for (const [name, color] of expected) {
    assert.equal(await colorOf(page.getByRole('option', { name, exact: true }).locator(':scope > span[aria-hidden="true"]')), color);
  }
  await page.getByRole('option', { name: 'Work', exact: true }).click();
  assert.equal(await colorOf(titleSwatch), expected[1][1]);
  assert.equal(await colorOf(calendar.locator('[aria-hidden="true"][style]')), expected[1][1]);
  const alignment = await titleSwatch.evaluate((element) => {
    const swatch = element.getBoundingClientRect();
    const icon = document.querySelector('form [role="group"][aria-label="Description"] svg').getBoundingClientRect();
    const title = document.querySelector('[aria-label="Title"]').getBoundingClientRect();
    return {
      horizontal: Math.abs(swatch.x + swatch.width / 2 - icon.x - icon.width / 2),
      vertical: Math.abs(swatch.y + swatch.height / 2 - title.y - title.height / 2),
    };
  });
  assert.ok(alignment.horizontal < 1 && alignment.vertical < 1, 'Title calendar swatch must align with row icons and title');
  await calendar.click();
  await page.getByRole('option', { name: 'Personal', exact: true }).click();
  assert.equal(await colorOf(titleSwatch), expected[0][1]);
}

async function verifyTextContainers(page) {
  const fields = await page.locator('form [role="group"][aria-label]').evaluateAll((rows) =>
    rows.filter((row) => ['Description', 'Location', 'Repeats'].includes(row.getAttribute('aria-label'))).map((row) => {
      const value = row.lastElementChild;
      const control = value.querySelector('button[aria-expanded]') ?? value.firstElementChild;
      const style = getComputedStyle(control);
      const box = control.getBoundingClientRect();
      const icon = row.querySelector('svg').getBoundingClientRect();
      return {
        label: row.getAttribute('aria-label'),
        width: box.width,
        available: value.getBoundingClientRect().width,
        textStart: box.x + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft),
        background: style.backgroundColor,
        radius: Number.parseFloat(style.borderTopLeftRadius),
        height: box.height,
        iconOffset: Math.abs(icon.y + icon.height / 2 - box.y - Math.min(box.height, matchMedia('(pointer: coarse)').matches ? 44 : 36) / 2),
      };
    })
  );
  assert.equal(fields.length, 3);
  for (const field of fields.filter((field) => field.label !== 'Repeats')) {
    assert.equal(field.background, fields[1].background, 'Text fields must match selector backgrounds');
    assert.ok(field.radius >= 12 && Math.abs(field.width - field.available) < 1, 'Text fields must use rounded full-width containers');
    assert.ok(Math.abs(field.textStart - fields[1].textStart) < 1, 'Text must align with selector text');
    assert.ok(field.iconOffset < 1, 'Text-field icons must align with the first control line');
  }
  await verifyDescriptionTextAlignment(page);
}

async function verifyDescriptionTextAlignment(page) {
  const alignment = await page.getByRole('group', { name: 'Description', exact: true }).evaluate((row) => {
    const editor = row.querySelector('[role="textbox"]');
    const paragraph = editor.textContent.trim()
      ? editor.querySelector('p')
      : row.querySelector('.pointer-events-none p');
    const selector = document.querySelector('button[aria-label="Repeats"]');
    const value = selector.querySelector('[id$="value"]');
    const firstTextRect = (element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      range.selectNodeContents(walker.nextNode());
      return range.getClientRects()[0];
    };
    const text = firstTextRect(paragraph);
    const selectorText = firstTextRect(value);
    const container = row.lastElementChild.firstElementChild.getBoundingClientRect();
    const trigger = selector.getBoundingClientRect();
    return {
      horizontal: Math.abs(text.x - selectorText.x),
      vertical: Math.abs((text.y - container.y) - (selectorText.y - trigger.y)),
      height: Math.abs(text.height - selectorText.height),
    };
  });
  assert.ok(alignment.horizontal < 1, `Description text must align horizontally: ${JSON.stringify(alignment)}`);
  assert.ok(alignment.vertical < 1, `Description text must align with selector text vertically: ${JSON.stringify(alignment)}`);
  assert.ok(alignment.height < 1, `Description and selector text must use matching typography: ${JSON.stringify(alignment)}`);
}
async function verifySelectorShape(page) {
  const minimumHeight = await page.evaluate(() => matchMedia('(pointer: coarse)').matches ? 44 : 36);
  const selectors = await page.locator('form button[aria-expanded]').evaluateAll((elements) => elements.map((element) => {
    const column = element.closest('[role="group"][aria-label]')?.lastElementChild;
    const style = getComputedStyle(element);
    const row = element.closest('[role="group"][aria-label]');
    const icon = row?.querySelector(':scope > svg, :scope > div:first-child > svg')?.getBoundingClientRect();
    const firstTrigger = row?.querySelector('button[aria-expanded]')?.getBoundingClientRect();
    return {
      label: element.getAttribute('aria-label'),
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      available: column?.getBoundingClientRect().width,
      radii: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius].map(Number.parseFloat),
      iconOffset: icon && firstTrigger ? Math.abs(icon.top + icon.height / 2 - firstTrigger.top - firstTrigger.height / 2) : null,
    };
  }));
  assert.ok(selectors.length >= 5);
  for (const selector of selectors) {
    assert.ok(selector.radii.every((radius) => radius >= 12), `${selector.label} must have more rounded corners`);
    assert.ok(selector.height >= minimumHeight, `${selector.label} must meet the ${minimumHeight}px trigger height`);
    assert.ok(Math.abs(selector.width - selector.available) < 1, `${selector.label} must fill its value column`);
    assert.ok(selector.iconOffset !== null && selector.iconOffset < 1, `${selector.label} row icon must be centered on its first selector; offset: ${selector.iconOffset}px`);
  }
  await page.keyboard.press('Tab');
  const triggers = page.locator('form button[aria-expanded], [data-event-editor-header] button[aria-expanded]');
  for (const trigger of await triggers.all()) {
    await trigger.focus();
    const focus = await trigger.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        visible: element.matches(':focus-visible'),
        outline: style.outlineStyle,
        shadowPixels: style.boxShadow.match(/-?[0-9.]+px/g)?.map(Number.parseFloat) ?? [],
      };
    });
    assert.equal(focus.visible, true);
    assert.equal(focus.outline, 'none');
    assert.ok(focus.shadowPixels.every((value) => value === 0), 'Triggers must not draw a focus ring');
  }
}

async function verifyHeader(page) {
  const header = page.locator('[data-event-editor-header]');
  const kind = header.getByRole('button', { name: /^Event kind/ });
  const bounds = await kind.boundingBox();
  const headerBounds = await header.boundingBox();
  const titleBounds = await page.getByLabel('Title', { exact: true }).boundingBox();
  assert.ok(bounds && headerBounds && titleBounds);
  assert.ok(bounds.width < headerBounds.width / 2, 'Event type must use a compact header selector');
  assert.ok(bounds.x < titleBounds.x && bounds.y + bounds.height <= titleBounds.y, 'Event type belongs at the top left');
  assert.equal(await page.getByRole('group', { name: 'Event type', exact: true }).count(), 0);
  const originalIcon = await kind.locator('svg').first().innerHTML();
  await kind.click();
  await page.getByRole('option', { name: 'Out of office', exact: true }).click();
  assert.match(await kind.innerText(), /Out of office/);
  assert.notEqual(await kind.locator('svg').first().innerHTML(), originalIcon, 'Selected event type must change its icon');
  await page.getByRole('group', { name: 'Decline', exact: true }).waitFor();
  await kind.click();
  await page.getByRole('option', { name: 'Event', exact: true }).click();
  assert.equal(await kind.locator('svg').first().innerHTML(), originalIcon);
}

async function verifyPendingSave(page) {
  await page.goto(fixture + '?pending-save');
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Pending fixture event');
  const save = page.locator('form').getByRole('button', { name: 'Create event', exact: true });
  const before = await save.boundingBox();
  await save.click();
  await page.locator('form button[aria-busy="true"]').waitFor();
  const after = await save.boundingBox();
  assert.ok(before && after);
  assert.ok(Math.abs(before.width - after.width) < 1, 'Loading must preserve the Create button width');
  assert.ok(Math.abs(before.height - after.height) < 1, 'Loading must preserve the Create button height');
  assert.equal(await save.isDisabled(), true);
  assert.equal(await save.locator('svg').isVisible(), true);
  assert.equal(await page.getByRole('button', { name: /^Event kind/ }).isDisabled(), true);
}

async function verifyDesktop(options, name) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, ...options });
  try {
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
    assert.deepEqual(rowLabels, ['Description', 'Repeats', 'Meeting link', 'Location', 'Notifications', 'Calendar', 'Guests']);
    await verifyHeader(page);
    await verifyDescriptionPosition(page);
    await verifyFieldSpacing(page);
    await verifySelectorShape(page);
    await verifyCalendarColors(page);
    await verifyTextContainers(page);
    await title.fill('Calendar draft stays here');
    const description = page.getByRole('textbox', { name: 'Description', exact: true });
    await description.fill('Keep this description when moving.');
    await verifyDescriptionTextAlignment(page);
    await description.fill('Keep this description when moving.\nAnother agenda item.');
    await verifyDescriptionTextAlignment(page);
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
    await verifySelectorShape(page);

    await page.getByRole('button', { name: 'Next week', exact: true }).click();
    await page.locator('.fc-scroller').evaluateAll((elements) => {
      for (const element of elements) element.scrollTop = element.scrollHeight;
    });
    await page.getByRole('button', { name: 'Change period', exact: true }).click();
    assert.equal(await title.inputValue(), 'Calendar draft stays here');
    await page.screenshot({ path: `/tmp/calendar-editor-${name}-popover.png` });

    await page.getByRole('button', { name: 'Move to sidebar', exact: true }).click();
    assert.equal(await title.inputValue(), 'Calendar draft stays here');
    await verifySidebarSurface(page);
    await verifyDescriptionPosition(page);
    await verifySelectorShape(page);
    await verifyTextContainers(page);
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
    await verifySidebarSurface(page);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await title.waitFor({ state: 'detached' });

    await page.getByRole('button', { name: 'Edit example event', exact: true }).click();
    await title.waitFor();
    assert.equal(await title.inputValue(), 'Weekly design review');
    await verifyDescriptionPosition(page);
    assert.equal(await start.count(), 0);
    assert.match(await page.getByRole('textbox', { name: 'Description', exact: true }).innerText(), /Existing agenda/);
    assert.equal(await page.getByRole('textbox', { name: 'Location', exact: true }).inputValue(), 'Design studio');
    assert.equal(await page.getByRole('button', { name: /^Event kind/ }).count(), 0);
    for (const name of ['Calendar', 'Guests', 'Meeting link', 'Notifications']) {
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
    await verifySidebarSurface(page);
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
    await verifyPendingSave(page);
    assert.deepEqual(errors, []);
    results.push(`${name}: aligned title, compact icon gaps, raised inset sidebar, calendar swatches, header type, selectors, loading button, persistent surfaces, recurrence, editing, and scoped save passed`);
  } finally {
    await context.close();
  }
}

async function verifyMobile() {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', (error) => { errors.push(error.message); console.error(error.stack); });
    await page.goto(fixture);
    await page.getByRole('button', { name: 'Create event', exact: true }).click();
    const title = page.getByLabel('Title', { exact: true });
    await title.waitFor();
    await page.locator('[data-corvu-drawer-content][data-transitioning]').waitFor({ state: 'detached' });
    assert.equal(await title.evaluate((element) => element === document.activeElement), false);
    await page.getByRole('button', { name: 'Edit event start date and time', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Move to sidebar', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Close event editor', exact: true }).count(), 0);
    await verifyHeader(page);
    await verifyFieldSpacing(page);
    await verifyDescriptionPosition(page);
    await verifySelectorShape(page);
    await verifyCalendarColors(page);
    await verifyTextContainers(page);
    await title.fill('Phone draft');
    await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Phone agenda\nAnother agenda item.');
    await verifyDescriptionTextAlignment(page);
    await page.getByRole('textbox', { name: 'Location', exact: true }).fill('South studio');
    await page.getByRole('button', { name: /Repeats/ }).click();
    await page.getByRole('option', { name: /Custom/ }).click();
    const recurrence = page.getByRole('dialog', { name: 'Custom recurrence', exact: true });
    await recurrence.getByRole('spinbutton', { name: 'Repeat interval', exact: true }).fill('2');
    await recurrence.getByRole('button', { name: 'Done', exact: true }).click();
    await recurrence.waitFor({ state: 'detached' });
    await verifySelectorShape(page);
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
    await verifyDescriptionPosition(page);
    await page.getByRole('button', { name: 'Edit event start date and time', exact: true }).waitFor();
    await page.getByRole('textbox', { name: 'Location', exact: true }).fill('Phone studio');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    const submitted = JSON.parse(await page.getByLabel('Saved event', { exact: true }).innerText());
    assert.equal(submitted.values.location, 'Phone studio');
    assert.equal(submitted.scope, 'all');
    await verifyPendingSave(page);
    assert.deepEqual(errors, []);
    results.push('phone: aligned title, compact icon gaps, calendar swatches, text containers, header type, loading button, full-height create/edit sheet, date controls, recurrence, and discard protection passed');
  } finally {
    await context.close();
  }
}

async function verifyGridSelection() {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  try {
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
