import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = process.env.CALENDAR_BROWSER_CDP
  ? await chromium.connectOverCDP(process.env.CALENDAR_BROWSER_CDP)
  : await chromium.launch({ headless: true, executablePath: process.env.CALENDAR_BROWSER_EXECUTABLE });
const base = process.env.CALENDAR_PREVIEW_URL ?? 'https://localhost:3000';
const fixture = `${base}/src/features/calendar-view/browser-test/index.html`;
const results = [];

async function openFixture(page, query = '') {
  let networkChanged;
  const trackFailure = (request) => {
    if (
      request.url().startsWith(base + '/') &&
      ['document', 'script'].includes(request.resourceType()) &&
      request.failure()?.errorText === 'net::ERR_NETWORK_CHANGED'
    ) networkChanged = request.url();
  };
  page.on('requestfailed', trackFailure);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      networkChanged = undefined;
      try {
        await page.goto(fixture + query);
        await page.getByRole('button', { name: 'Select 10 AM', exact: true }).waitFor({ timeout: 15000 });
        return;
      } catch (error) {
        if (!networkChanged || attempt === 1) throw error;
        console.warn('Retrying fixture module load after ERR_NETWORK_CHANGED:', networkChanged);
      }
    }
  } finally {
    page.off('requestfailed', trackFailure);
  }
}

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

async function verifyPopoverGeometry(page) {
  const geometry = await page.getByRole('dialog', { name: /^(New|Edit) event$/ }).evaluate((element) => new Promise((resolve) => {
    const measure = () => {
      const popover = element.getBoundingClientRect();
      const boundaryElement = document.querySelector('[aria-label="Calendar grid"]').parentElement;
      const boundary = boundaryElement.getBoundingClientRect();
      const anchor = boundaryElement.querySelector('[data-calendar-editor-anchor]').getBoundingClientRect();
      const visibleAnchor = anchor.right >= boundary.left && anchor.left <= boundary.right && anchor.bottom >= boundary.top && anchor.top <= boundary.bottom;
      const room = Math.max(boundary.right - anchor.right, anchor.left - boundary.left);
      return {
        contained: popover.left >= boundary.left + 11 && popover.right <= boundary.right - 11 && popover.top >= boundary.top + 11 && popover.bottom <= boundary.bottom - 11,
        adjacent: Math.min(Math.abs(popover.left - anchor.right - 8), Math.abs(anchor.left - popover.right - 8)) < 2,
        mustBeAdjacent: visibleAnchor && room >= popover.width + 20,
      };
    };
    const timeout = AbortSignal.timeout(5000);
    const finish = () => { observer.disconnect(); timeout.removeEventListener('abort', finish); resolve(measure()); };
    const ready = () => { const value = measure(); return value.contained && (!value.mustBeAdjacent || value.adjacent); };
    const observer = new MutationObserver(() => { if (ready()) finish(); });
    observer.observe(element.parentElement, { attributes: true, attributeFilter: ['style'] });
    timeout.addEventListener('abort', finish, { once: true });
    if (ready()) finish();
  }));
  assert.equal(geometry.contained, true, `Editor must fit the calendar: ${JSON.stringify(geometry)}`);
  assert.ok(!geometry.mustBeAdjacent || geometry.adjacent, `Editor must sit beside the event or slot: ${JSON.stringify(geometry)}`);
}

async function verifySidebarGeometry(page) {
  const sidebar = page.getByRole('dialog', { name: /^(New|Edit) event$/ });
  const geometry = await sidebar.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const boundaryElement = document.querySelector('[aria-label="Calendar grid"]').parentElement;
    const boundary = boundaryElement.getBoundingClientRect();
    return {
      tag: element.tagName,
      top: box.top - boundary.top - boundaryElement.clientTop,
      bottom: boundary.top + boundaryElement.clientTop + boundaryElement.clientHeight - box.bottom,
      right: boundary.left + boundaryElement.clientLeft + boundaryElement.clientWidth - box.right,
      radius: Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
    };
  });
  assert.equal(geometry.tag, 'ASIDE');
  for (const edge of ['top', 'bottom', 'right']) {
    assert.ok(Math.abs(geometry[edge] - 12) < 1, `Sidebar must retain 12px insets: ${JSON.stringify(geometry)}`);
  }
  assert.equal(geometry.radius, 12);
}
async function verifyDateRange(page, monthCount) {
  const trigger = page.getByRole('button', { name: 'Edit event date and time range', exact: true });
  const picker = page.getByRole('dialog', { name: 'Event date and time', exact: true });
  const state = async () => JSON.parse(await page.getByLabel('Draft date range', { exact: true }).innerText());
  const day = (month, number) => picker.locator('table').nth(month).locator('button:not(:disabled)').filter({ hasText: new RegExp(`^${number}$`) });
  const before = await state();
  await trigger.click();
  const initialMonths = before.start.slice(0, 10) === before.end.slice(0, 10) ? 1 : monthCount;
  assert.equal(await picker.locator('table').count(), initialMonths, 'A same-day range shows one calendar');
  const portal = await picker.evaluate((element) => ({
    global: !element.closest('[aria-label="New event"], [aria-label="Edit event"], [data-corvu-drawer-content]'),
    depth: element.closest('[data-depth]')?.getAttribute('data-depth'),
    labelSize: Number.parseFloat(getComputedStyle(Array.from(element.querySelectorAll('span')).find((span) => span.textContent === 'Selected range')).fontSize),
  }));
  assert.equal(portal.global, true, 'Date picker must portal outside the sidebar or editor');
  assert.equal(portal.depth, '4');
  assert.equal(portal.labelSize, 12, 'Selected range label must stay secondary');
  assert.equal(await picker.getByText('Choose a start day, then an end day.', { exact: true }).count(), 0);
  const outsideDays = picker.locator('table').first().locator('[data-outside-month]');
  assert.ok(await outsideDays.count() > 0, 'Show dates from adjacent months');
  for (const outsideDay of await outsideDays.all()) {
    assert.equal(await outsideDay.isVisible(), true);
    assert.notEqual(await outsideDay.evaluate((element) => getComputedStyle(element).visibility), 'hidden');
  }
  const summaryGap = await picker.getByRole('status').evaluate((element) => {
    const table = Array.from(element.previousElementSibling.querySelectorAll('table')).at(-1);
    return element.getBoundingClientRect().top - table.getBoundingClientRect().bottom;
  });
  assert.ok(summaryGap <= 9, 'Keep the summary close to the calendar');
  await picker.getByRole('button', { name: /^Choose month and year,/ }).last().click();
  const monthPicker = page.getByRole('dialog', { name: 'Choose month and year', exact: true });
  await monthPicker.getByRole('button', { name: 'Choose year, currently 2030' }).click();
  await monthPicker.getByRole('button', { name: '2032', exact: true }).click();
  await monthPicker.getByRole('button', { name: 'November 2032', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await monthPicker.waitFor({ state: 'detached' });
  await picker.getByRole('button', { name: 'Choose month and year, currently December 2032', exact: true }).waitFor();
  if (initialMonths === 2) {
    await picker.getByRole('button', { name: 'Choose month and year, currently November 2032', exact: true }).waitFor();
  }
  assert.deepEqual(await state(), before, 'Month and year navigation must not change event dates');
  await picker.getByRole('button', { name: /^Choose month and year,/ }).first().click();
  await monthPicker.getByRole('button', { name: 'Choose year, currently 2032' }).click();
  await monthPicker.getByRole('button', { name: '2030', exact: true }).click();
  await monthPicker.getByRole('button', { name: 'October 2030', exact: true }).click();
  await monthPicker.waitFor({ state: 'detached' });
  await picker.getByRole('button', { name: /^Choose month and year,/ }).first().click();
  await page.keyboard.press('Escape');
  await monthPicker.waitFor({ state: 'detached' });
  assert.equal(await picker.isVisible(), true, 'Escape from the month selector must retain the date picker');
  assert.deepEqual(await state(), before);
  await day(0, 30).click();
  assert.deepEqual(await state(), before, 'A partial range must not change the event dates');
  assert.match(await picker.getByRole('status').innerText(), /Oct 30, 2030/);
  assert.match(await picker.getByRole('status').innerText(), /Select an end date/);
  if (initialMonths === 1) await picker.getByRole('button', { name: 'Go to next month', exact: true }).click();
  await day(initialMonths - 1, 2).click();
  assert.equal(await picker.locator('table').count(), monthCount, 'Multiple days use connected months on desktop');
  if (monthCount === 2 && page.viewportSize().width >= 640) {
    const panels = await picker.locator('table').evaluateAll((tables) => tables.map((table) => ({ x: table.getBoundingClientRect().x, y: table.getBoundingClientRect().y })));
    assert.ok(Math.abs(panels[0].y - panels[1].y) < 1 && panels[1].x > panels[0].x, 'The sidebar must not force month panels into a vertical stack');
  }
  const times = await Promise.all([picker.getByLabel('Start time', { exact: true }).boundingBox(), picker.getByLabel('End time', { exact: true }).boundingBox()]);
  assert.ok(times[0] && times[1] && Math.abs(times[0].y - times[1].y) < 1, 'Start and end time controls must be side by side');
  const selected = await state();
  assert.equal(selected.start, `2030-10-30${before.start.slice(10)}`);
  assert.equal(selected.end, `2030-11-02${before.end.slice(10)}`);
  const summary = await picker.getByRole('status').innerText();
  assert.match(summary, /Oct 30, 2030/);
  assert.match(summary, /Nov 2, 2030/);
  assert.ok(await picker.locator('[data-in-range]').count() >= 2, 'The connected range must stay highlighted across months');
  if (monthCount === 2) {
    for (const table of await picker.locator('table').all()) {
      assert.ok(await table.locator('[data-in-range]').count() > 0, 'Both months must highlight the same selected range');
    }
  } else {
    await picker.getByRole('button', { name: 'Go to previous month', exact: true }).click();
  }
  await day(0, 31).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), '1', 'Keyboard navigation must cross the month boundary');
  assert.deepEqual(await state(), selected, 'Keyboard navigation must not change the selected range');
  await picker.getByLabel('Start time', { exact: true }).fill('10:15');
  await picker.getByLabel('End time', { exact: true }).fill('12:30');
  assert.deepEqual(await state(), { start: '2030-10-30T10:15', end: '2030-11-02T12:30', allDay: false });
  await page.getByRole('dialog', { name: 'Choose start time', exact: true }).waitFor({ state: 'detached' });
  await page.getByRole('dialog', { name: 'Choose end time', exact: true }).getByRole('listbox').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('listbox').waitFor({ state: 'detached' });
  assert.equal(await picker.isVisible(), true, 'Dismissing the time list must keep the range picker open');
  await page.screenshot({ path: `/tmp/calendar-range-picker-${page.viewportSize().width}.png` });
  assert.equal(await page.getByRole('button', { name: 'Discard', exact: true }).count(), 0);
  await page.keyboard.press('Escape');
  await picker.waitFor({ state: 'detached' });
  assert.equal(await page.getByLabel('Title', { exact: true }).isVisible(), true);
  assert.equal(await page.getByRole('button', { name: 'Discard', exact: true }).count(), 0, 'Dismissing the range picker must keep the editor open');
  assert.match(await trigger.innerText(), /Oct 30, 2030/);
  assert.match(await trigger.innerText(), /Nov 2, 2030/);
  await trigger.click();
  await picker.getByText('All day', { exact: true }).click();
  assert.deepEqual(await state(), { start: '2030-10-30', end: '2030-11-02', allDay: true });
  assert.equal(await picker.getByLabel('Start time', { exact: true }).isDisabled(), true);
  assert.equal(await picker.getByLabel('End time', { exact: true }).isDisabled(), true);
  await picker.getByText('All day', { exact: true }).click();
  await page.keyboard.press('Escape');
  await picker.waitFor({ state: 'detached' });
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

async function verifyEventKinds(page) {
  const kinds = page.getByRole('radiogroup', { name: 'Event type', exact: true });
  const bounds = await kinds.boundingBox();
  const titleBounds = await page.getByLabel('Title', { exact: true }).boundingBox();
  const descriptionBounds = await page.getByRole('group', { name: 'Description', exact: true }).boundingBox();
  assert.ok(bounds && titleBounds && descriptionBounds);
  assert.ok(bounds.y >= titleBounds.y + titleBounds.height, 'Event-type pills must sit below the title');
  assert.ok(bounds.y + bounds.height <= descriptionBounds.y, 'Event-type pills must precede the description');
  assert.equal(await page.getByRole('button', { name: /^Event kind/ }).count(), 0);
  assert.equal(await kinds.getByRole('radio', { name: 'Event', exact: true }).isChecked(), true);
  assert.equal(await kinds.locator('label svg').count(), 2, 'Both event types must have their own icon');
  await kinds.getByText('Out of office', { exact: true }).click();
  assert.equal(await kinds.getByRole('radio', { name: 'Out of office', exact: true }).isChecked(), true);
  await page.getByRole('group', { name: 'Decline', exact: true }).waitFor();
  await kinds.getByText('Event', { exact: true }).click();
  assert.equal(await kinds.getByRole('radio', { name: 'Event', exact: true }).isChecked(), true);
  await kinds.getByRole('radio', { name: 'Event', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await kinds.getByRole('radio', { name: 'Out of office', exact: true }).isChecked(), true, 'Pills must support keyboard selection');
  await kinds.getByText('Event', { exact: true }).click();
}

async function verifyPendingSave(page) {
  await openFixture(page, '?pending-save');
  await page.getByRole('button', { name: 'Select 10 AM', exact: true }).click();
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
  for (const radio of await page.getByRole('radiogroup', { name: 'Event type', exact: true }).getByRole('radio').all()) {
    assert.equal(await radio.isDisabled(), true);
  }
  const move = page.getByRole('button', { name: 'Move to sidebar', exact: true });
  if (await move.count()) assert.equal(await move.isDisabled(), true);
}

async function verifyDesktop(options, name) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, ...options });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', (error) => { errors.push(error.message); console.error(error.stack); });
    await openFixture(page);
    await page.getByRole('button', { name: 'Select 10 AM', exact: true }).click();
    const title = page.getByLabel('Title', { exact: true });
    const start = page.getByRole('button', { name: 'Edit event date and time range', exact: true });
    await title.waitFor();
    assert.equal(await title.evaluate((element) => element === document.activeElement), true);
    await start.waitFor();
    await verifyPopoverGeometry(page);
    const rowLabels = await page.locator('form [role="group"][aria-label]').evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')));
    assert.deepEqual(rowLabels, ['Description', 'Date and time', 'Repeats', 'Meeting link', 'Location', 'Notifications', 'Calendar', 'Guests']);
    await verifyEventKinds(page);
    await verifyDescriptionPosition(page);
    await verifyFieldSpacing(page);
    await verifySelectorShape(page);
    await verifyCalendarColors(page);
    await verifyTextContainers(page);
    await verifyDateRange(page, 2);
    await title.fill('Calendar draft stays here');
    const description = page.getByRole('textbox', { name: 'Description', exact: true });
    await description.fill('Keep this description in the popover.');
    await verifyDescriptionTextAlignment(page);
    await description.fill('Keep this description in the popover.\nAnother agenda item.');
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
    await page.getByRole('button', { name: 'Next week', exact: true }).click();
    await page.getByRole('button', { name: 'Previous week', exact: true }).click();
    await page.locator('.fc-event').filter({ hasText: 'Calendar draft stays here' }).first().waitFor();
    assert.equal(await title.inputValue(), 'Calendar draft stays here', 'Period navigation must retain the draft preview and editor');
    await verifyPopoverGeometry(page);
    await page.locator('.fc-scroller').evaluateAll((elements) => {
      for (const element of elements) element.scrollTop = element.scrollHeight;
    });
    await verifyPopoverGeometry(page);
    await page.getByRole('button', { name: 'Change period', exact: true }).click();
    assert.equal(await title.inputValue(), 'Calendar draft stays here');
    await verifyPopoverGeometry(page);
    await page.setViewportSize({ width: options.viewport.width - 80, height: options.viewport.height - 60 });
    await verifyPopoverGeometry(page);
    await page.setViewportSize(options.viewport);
    await verifyPopoverGeometry(page);
    await page.screenshot({ path: `/tmp/calendar-editor-${name}-popover.png` });
    const draftRange = await page.getByLabel('Draft date range', { exact: true }).innerText();
    await page.getByRole('button', { name: 'Move to sidebar', exact: true }).click();
    await verifySidebarGeometry(page);
    await page.getByRole('button', { name: 'Leave calendar', exact: true }).click();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    assert.equal(await title.inputValue(), 'Calendar draft stays here', 'Sidebar navigation must preserve edits after Keep editing');
    await page.getByRole('button', { name: 'Next week', exact: true }).click();
    await page.locator('header > span').click();
    await verifySidebarGeometry(page);
    assert.equal(await page.getByRole('button', { name: 'Discard', exact: true }).count(), 0, 'Sidebar navigation and outside clicks must not dismiss the draft');
    assert.equal(await page.getByLabel('Draft date range', { exact: true }).innerText(), draftRange);
    await page.screenshot({ path: `/tmp/calendar-editor-${name}-sidebar.png` });

    assert.equal(await title.inputValue(), 'Calendar draft stays here');
    await verifyDescriptionPosition(page);
    await verifySelectorShape(page);
    await verifyTextContainers(page);
    assert.match(await page.getByRole('button', { name: 'Guests', exact: true }).innerText(), /Ada Lovelace/);
    assert.match(await page.getByRole('textbox', { name: 'Description', exact: true }).innerText(), /Keep this description/);
    assert.equal(await page.getByRole('textbox', { name: 'Location', exact: true }).inputValue(), 'Design studio');
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

    await page.getByRole('button', { name: 'Close event editor', exact: true }).click();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    assert.equal(await title.inputValue(), 'Calendar draft stays here');
    await page.getByRole('button', { name: 'Close event editor', exact: true }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Create event', exact: true }).click();
    await title.waitFor();
    await start.waitFor();
    await verifySidebarGeometry(page);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await title.waitFor({ state: 'detached' });

    await page.getByRole('button', { name: 'Edit example event', exact: true }).click();
    await title.waitFor();
    assert.equal(await title.inputValue(), 'Weekly design review');
    await verifyDescriptionPosition(page);
    await start.waitFor();
    await verifyPopoverGeometry(page);
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
    assert.equal(await title.inputValue(), 'Revised design review');
    await start.waitFor();
    await page.getByRole('button', { name: 'Move to sidebar', exact: true }).click();
    await verifySidebarGeometry(page);
    assert.equal(await page.getByRole('radio', { name: 'This event', exact: true }).isChecked(), true, 'Moving the editor must preserve save scope');
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
    assert.equal(await page.getByRole('radio', { name: 'This event', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    const repeated = JSON.parse(await page.getByLabel('Saved event', { exact: true }).innerText());
    assert.equal(repeated.scope, 'all');
    assert.match(repeated.values.recurrenceLines.join(';'), /FREQ=DAILY/);
    await verifyPendingSave(page);
    assert.deepEqual(errors, []);
    results.push(`${name}: connected range, event-type pills, persistent popover, sidebar transfer, recurrence, dismissal, and scoped save passed`);
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
    await openFixture(page);
    await page.getByRole('button', { name: 'Create event', exact: true }).click();
    const title = page.getByLabel('Title', { exact: true });
    await title.waitFor();
    await page.locator('[data-corvu-drawer-content][data-transitioning]').waitFor({ state: 'detached' });
    assert.equal(await title.evaluate((element) => element === document.activeElement), false);
    await page.getByRole('button', { name: 'Edit event date and time range', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Close event editor', exact: true }).count(), 0);
    await verifyEventKinds(page);
    await verifyFieldSpacing(page);
    await verifyDescriptionPosition(page);
    await verifySelectorShape(page);
    await verifyCalendarColors(page);
    await verifyTextContainers(page);
    await verifyDateRange(page, 1);
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
    await page.getByRole('button', { name: 'Edit event date and time range', exact: true }).waitFor();
    await page.getByRole('textbox', { name: 'Location', exact: true }).fill('Phone studio');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    const submitted = JSON.parse(await page.getByLabel('Saved event', { exact: true }).innerText());
    assert.equal(submitted.values.location, 'Phone studio');
    assert.equal(submitted.scope, 'all');
    await verifyPendingSave(page);
    assert.deepEqual(errors, []);
    results.push('phone: one-month connected range, start/end times, All day, keyboard navigation, full-height create/edit sheet, recurrence, and discard protection passed');
  } finally {
    await context.close();
  }
}

async function verifyNarrowDatePicker() {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 500, height: 900 } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    await openFixture(page);
    await page.getByRole('button', { name: 'Select 10 AM', exact: true }).click();
    await page.getByRole('button', { name: 'Edit event date and time range', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Event date and time', exact: true });
    await picker.locator('table').first().locator('button').filter({ hasText: /^20$/ }).click();
    await picker.locator('table').first().locator('button').filter({ hasText: /^22$/ }).click();
    const months = await picker.locator('table').evaluateAll((tables) => tables.map((table) => {
      const box = table.getBoundingClientRect();
      return { x: box.x, top: box.top, bottom: box.bottom, width: box.width };
    }));
    assert.equal(months.length, 2, 'A narrow non-touch window keeps two connected months');
    assert.ok(months[1].top >= months[0].bottom, 'Month panels must stack when constrained');
    assert.ok(Math.abs(months[0].x - months[1].x) < 1, 'Stacked month panels must align');
    const width = (await picker.boundingBox()).width;
    assert.ok(months.every((month) => month.width < width), 'Month grids must not overflow the picker');
    await page.screenshot({ path: '/tmp/calendar-range-picker-stacked.png' });
    await page.keyboard.press('Escape');
    await picker.waitFor({ state: 'detached' });
    await verifyDateRange(page, 2);
    results.push('narrow desktop: stacked connected months, live summary, selection, and time controls passed');
  } finally {
    await context.close();
  }
}

async function verifyShortCalendarDatePicker(height) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 900, height } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    await openFixture(page);
    await page.getByRole('button', { name: 'Select 10 AM', exact: true }).click();
    const end = page.getByRole('button', { name: 'Edit event date and time range', exact: true });
    await end.click();
    const picker = page.getByRole('dialog', { name: 'Event date and time', exact: true });
    // Both ends of the picker must accept pointer input beyond the editor's bounds.
    await picker.getByRole('button', { name: 'Go to previous month', exact: true }).click();
    const bounds = await picker.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: innerHeight - box.bottom, left: box.left, right: innerWidth - box.right };
    });
    assert.ok(Object.values(bounds).every((value) => value >= 0), `Global date picker must fit the ${height}px viewport: ${JSON.stringify(bounds)}`);
    await picker.getByRole('button', { name: 'Go to next month', exact: true }).click();
    const days = picker.locator('table').first().locator('button:not(:disabled)');
    await days.filter({ hasText: /^21$/ }).click();
    await days.filter({ hasText: /^22$/ }).click();
    await picker.getByRole('textbox', { name: 'End time', exact: true }).fill('12:15');
    const timeMenu = page.getByRole('dialog', { name: 'Choose end time', exact: true });
    await timeMenu.waitFor();
    await timeMenu.getByRole('option', { name: /12:30 PM/ }).first().click();
    await page.getByRole('dialog', { name: 'Choose end time', exact: true }).waitFor({ state: 'detached' });
    assert.equal(await picker.isVisible(), true);
    await page.keyboard.press('Escape');
    await picker.waitFor({ state: 'detached' });
    assert.match(await end.innerText(), /Oct 22, 2030/);
    assert.match(await end.innerText(), /12:30 PM/);
    await verifyPopoverGeometry(page);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).waitFor({ state: 'detached' });
    results.push(`short calendar (${height}px): date navigation, date selection, and time input stay reachable`);
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
    await openFixture(page);
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
    await verifyPopoverGeometry(page);
    // A clean drag draft is replaced by a calendar click without confirmation.
    const clickRow = await page.locator('.fc-timegrid-slot[data-time="12:00:00"]').first().boundingBox();
    const clickColumn = await page.locator('.fc-timegrid-col[data-date]').first().boundingBox();
    assert.ok(clickRow && clickColumn);
    await page.mouse.click(clickColumn.x + clickColumn.width / 2, clickRow.y + clickRow.height / 2);
    assert.equal(await page.getByRole('button', { name: 'Discard', exact: true }).count(), 0);
    assert.ok(await page.locator('.fc-highlight, .fc-event-mirror').count() > 0, 'replacement keeps its calendar selection highlight');
    const start = page.getByRole('button', { name: 'Edit event date and time range', exact: true });
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
    assert.match(await start.innerText(), /3:00 PM/);
    await title.fill('Dragged draft');
    await page.getByRole('button', { name: 'Next week', exact: true }).click();
    assert.equal(await title.inputValue(), 'Dragged draft');
    await page.getByRole('button', { name: 'Previous week', exact: true }).click();
    await page.locator('.fc-event').filter({ hasText: 'Dragged draft' }).first().waitFor();
    await page.getByRole('button', { name: 'Close event editor', exact: true }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Change period', exact: true }).click();
    const day = page.locator('.fc-daygrid-day-frame').nth(10);
    await day.click({ position: { x: 20, y: 45 } });
    await title.waitFor();
    const range = page.getByRole('button', { name: 'Edit event date and time range', exact: true });
    await range.click();
    assert.equal(await page.getByRole('switch', { name: 'All day', exact: true }).isChecked(), true);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await title.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Change period', exact: true }).click();
    const rightSlot = await page.locator('.fc-timegrid-slot[data-time="10:00:00"]').first().boundingBox();
    const rightDay = await page.locator('.fc-timegrid-col[data-date]').last().boundingBox();
    assert.ok(rightSlot && rightDay);
    await page.mouse.click(rightDay.x + rightDay.width / 2, rightSlot.y + rightSlot.height / 2);
    await title.waitFor();
    await verifyPopoverGeometry(page);
    const flipped = await page.getByRole('dialog', { name: 'New event', exact: true }).evaluate((element) => element.getBoundingClientRect().right <= document.querySelector('[data-calendar-editor-anchor]').getBoundingClientRect().left);
    assert.equal(flipped, true, 'Right-edge selections must flip the editor to the left');
    await page.getByRole('button', { name: 'Leave calendar', exact: true }).click();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await title.waitFor();
    await page.getByRole('button', { name: 'Leave calendar', exact: true }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await page.getByText('Left calendar', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    results.push('grid: timed drag, clean replacement, Keep editing, Discard replacement, navigation, and Month creation passed');
  } finally {
    await context.close();
  }
}
try {
  if (process.argv.includes('--phone-only')) {
    await verifyMobile();
  } else {
    await verifyGridSelection();
    if (!process.argv.includes('--grid-only')) {
      await verifyDesktop({ viewport: { width: 1440, height: 1000 } }, 'desktop');
      await verifyDesktop({ viewport: { width: 1024, height: 900 }, hasTouch: true }, 'tablet');
      await verifyShortCalendarDatePicker(550);
      await verifyNarrowDatePicker();
      await verifyShortCalendarDatePicker(360);
      await verifyMobile();
    }
  }
} finally {
  console.log(results.join('\n'));
  await browser.close();
}
