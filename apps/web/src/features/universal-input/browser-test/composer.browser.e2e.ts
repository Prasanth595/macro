import { expect, test } from '@playwright/test';

test('saves an email only after Save as draft is clicked and refocuses without sending', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('Email John that I will be late');
  const save = page.getByRole('button', { name: 'Save as draft', exact: true });
  await expect(save).toBeEnabled();
  await page
    .getByRole('textbox', { name: 'Subject', exact: true })
    .fill('Still working on this');
  await expect(save).toBeEnabled();
  await expect(page.getByTestId('email-draft-count')).toHaveText('0');
  await expect(page.getByTestId('submission-count')).toHaveText('0');
  await save.click();
  await expect(page.getByTestId('email-draft-count')).toHaveText('1');
  await expect(page.getByTestId('last-email-draft')).toContainText(
    'Still working on this'
  );
  await expect(page.getByTestId('submission-count')).toHaveText('0');
  await expect(
    page.getByText('Email draft saved', { exact: true })
  ).toBeVisible();
  await expect(input).toHaveText('');
  await expect(input).toBeFocused();
});

test('adds an external email address with the shared recipient control and preserves manual addressing', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('Email John that I’ll be late');
  const to = page.getByRole('combobox', { name: 'To', exact: true });
  await to.fill('external@example.org');
  await to.press('Enter');
  await expect(to).toHaveValue('');
  await page
    .getByRole('textbox', { name: 'Subject', exact: true })
    .fill('My subject');
  await input.fill('Email John with a changed thought');
  const send = page.getByRole('button', { name: 'Send email', exact: true });
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByTestId('last-submission')).toContainText(
    'external@example.org'
  );
  await expect(page.getByTestId('last-submission')).toContainText('My subject');
});

test('chooses guests with the standard event picker and preserves them through inference', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('Call John at 3pm tomorrow');
  await page.getByRole('button', { name: 'Guests', exact: true }).click();
  await expect(page.getByPlaceholder('Add guests...')).toBeVisible();
  await page
    .getByRole('menu')
    .getByText('John Adams', { exact: false })
    .click();
  await page.getByPlaceholder('Add guests...').press('Escape');
  await input.fill('Call John at 3pm tomorrow about the launch');
  const submit = page.getByRole('button', {
    name: 'Create event',
    exact: true,
  });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByTestId('last-submission')).toContainText(
    'john@example.com'
  );
});

test('edits a task through its rich title and description while later predictions preserve manual fields', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('notification clicks are broken');
  const title = page.getByRole('textbox', { name: 'Title', exact: true });
  await expect(title).toBeVisible();
  await title.fill('Route notification clicks');
  await title.press('Enter');
  const body = page.getByRole('textbox', { name: 'Description', exact: true });
  await expect(body).toBeFocused();
  await body.fill('Reproduce on mobile');
  await body.press('ControlOrMeta+a');
  await body.press('ControlOrMeta+b');
  await input.fill('notification clicks are broken, urgent');
  await expect(title).toHaveText('Route notification clicks');
  await expect(body.locator('strong, b')).toHaveText('Reproduce on mobile');
  await page.reload();
  await expect(title).toHaveText('Route notification clicks');
  await expect(body.locator('strong, b')).toHaveText('Reproduce on mobile');
  await expect(
    page.getByRole('button', { name: 'Create task', exact: true })
  ).toBeEnabled();
  await title.press('ControlOrMeta+Enter');
  await expect(page.getByTestId('last-submission')).toContainText(
    '**Reproduce on mobile**'
  );
});

test('shows the note body, preserves manual formatting through predictions and reload, and submits it', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('Research notes\nLaunch observations');
  const create = page.getByRole('button', { name: 'Create note', exact: true });
  await expect(create).toBeEnabled();
  const body = page.getByRole('textbox', { name: 'Note body', exact: true });
  await expect(body).toContainText('Research notes');
  await expect(body).toContainText('Launch observations');
  await expect(input).toBeFocused();
  await body.fill('Reviewed notes');
  await body.press('ControlOrMeta+a');
  await body.press('ControlOrMeta+b');
  await expect(body.locator('strong, b')).toContainText('Reviewed notes');
  await input.fill('Research notes\nNew observations');
  await expect(create).toBeEnabled();
  await expect(body).toHaveText('Reviewed notes');
  await page.reload();
  await expect(create).toBeEnabled();
  await expect(body.locator('strong, b')).toContainText('Reviewed notes');
  await page.screenshot({ path: '/tmp/universal-note-body.png' });
  await create.click();
  await expect(page.getByTestId('submission-count')).toHaveText('1');
  await expect(page.getByTestId('last-submission')).toContainText(
    '"body":"**Reviewed notes**"'
  );
  await expect(input).toHaveText('');
  await expect(input).toBeFocused();
});

test('starts on one line, rotates examples without remounting, and places the form and shortcut below', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  const example = page.getByTestId('input-example');
  await expect(example).toHaveText('try: dinner with julia tomorrow at 9pm');
  expect((await input.boundingBox())!.height).toBeLessThan(32);
  const surface = page.getByTestId('universal-input-surface');
  expect((await surface.boundingBox())!.height).toBeCloseTo(48.75, 1);
  await page.setViewportSize({ width: 600, height: 1000 });
  expect((await surface.boundingBox())!.height).toBeCloseTo(48.75, 1);
  await page.setViewportSize({ width: 1000, height: 1000 });
  const radius = await surface.evaluate((node) =>
    parseFloat(getComputedStyle(node).borderTopLeftRadius)
  );
  expect(radius).toBe(26.25);
  await input.evaluate((node) => node.setAttribute('data-original', 'true'));
  await expect
    .poll(
      async () => {
        const text = await example.textContent();
        return (
          text?.startsWith('try: ') &&
          text.length < 'try: dinner with julia tomorrow at 9pm'.length
        );
      },
      { timeout: 7000, intervals: [50] }
    )
    .toBe(true);
  await expect(example).toHaveText('try: email julia that I’ll be late', {
    timeout: 8000,
  });
  await expect(input).toHaveAttribute('data-original', 'true');
  await input.fill(
    'This is a long draft that wraps without an explicit newline. '.repeat(6)
  );
  await expect
    .poll(async () => (await input.boundingBox())!.height)
    .toBeGreaterThan(40);
  expect(
    await surface.evaluate((node) =>
      parseFloat(getComputedStyle(node).borderTopLeftRadius)
    )
  ).toBe(radius);
  await page.screenshot({ path: '/tmp/universal-channel-rounding.png' });
  await input.fill('Email John\nCan we reschedule tomorrow?');
  await expect(example).not.toBeVisible();
  const body = page.getByRole('textbox', {
    name: 'Outgoing message',
    exact: true,
  });
  await expect(body).toHaveText('I’ll be late');
  expect((await input.boundingBox())!.height).toBeGreaterThan(40);
  expect(
    await surface.evaluate((node) =>
      parseFloat(getComputedStyle(node).borderTopLeftRadius)
    )
  ).toBe(radius);
  expect((await body.boundingBox())!.y).toBeGreaterThan(
    (await input.boundingBox())!.y
  );
  await expect(
    page.getByRole('button', { name: 'Next likely type' })
  ).toHaveCount(0);
  const send = page.getByRole('button', { name: 'Send email', exact: true });
  await expect(send.getByTestId('submit-shortcut')).toHaveText(/(⌘|Ctrl) ↵/);
  await body.click();
  await body.fill('A formatted message');
  await body.press('ControlOrMeta+a');
  await body.press('ControlOrMeta+b');
  await expect(body.locator('strong, b')).toContainText('A formatted message');
  await expect(send).toBeEnabled();
  await body.press('ControlOrMeta+Enter');
  await expect(page.getByTestId('submission-count')).toHaveText('1');
  await expect(input).toBeFocused();
});

test('reveals email addressing and body before providers finish and preserves a manual body edit', async ({
  page,
}) => {
  await page.goto('/?classify-delay=1200&extract-delay=1200');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('Email John\nCan we reschedule tomorrow?');
  await expect(
    page.getByLabel('Content type').locator('option:checked')
  ).toHaveText('Auto · Email', { timeout: 800 });
  const body = page.getByLabel('Outgoing message');
  await expect(body).toHaveText('Can we reschedule tomorrow?', {
    timeout: 800,
  });
  await expect(page.getByText('John Adams', { exact: true })).toBeVisible({
    timeout: 800,
  });
  await expect(
    page.getByRole('button', { name: 'Send email', exact: true })
  ).toBeDisabled();
  await expect(input).toBeFocused();
  await body.click();
  await body.fill('My message to John');
  await input.fill('Email John\nA different proposed body');
  await expect(body).toHaveText('My message to John');
  await expect(
    page.getByRole('button', { name: 'Send email', exact: true })
  ).toBeEnabled();
  await expect(body).toHaveText('My message to John');
  await expect(page.getByTestId('submission-count')).toHaveText('0');
});

test('predicts a new type while the previous extraction is still running', async ({
  page,
}) => {
  await page.goto('/?extract-delay=3000');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('notification clicks are broken');
  await expect(page.getByTestId('extraction-count')).toHaveText('1');
  await input.fill('Research notes about launch dates');
  await expect(
    page.getByLabel('Content type').locator('option:checked')
  ).toHaveText('Auto · Note', { timeout: 1200 });
  await expect(page.getByTestId('classification-count')).toHaveText('2');
  await expect(page.getByTestId('extraction-count')).toHaveText('1');
  await expect(page.getByLabel('Title', { exact: true })).toHaveText(
    'Research notes about launch dates'
  );
  await expect(input).toBeFocused();
  await expect(page.getByTestId('extraction-count')).toHaveText('2');
  await expect(page.getByLabel('Title', { exact: true })).toHaveText(
    'Research notes about launch dates'
  );
  await expect(page.getByTestId('submission-count')).toHaveText('0');
});

test('starts blank and preserves the editor, focus, caret and undo as calendar fields appear', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await expect(input).toHaveText('');
  await expect(input).not.toHaveAttribute('placeholder');
  await input.evaluate((element) => {
    element.setAttribute('data-original', 'true');
  });
  await input.pressSequentially('Call John at 3pm tomorrow');
  await expect(
    page.getByRole('button', { name: 'Create event', exact: true })
  ).toBeEnabled();
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('data-original', 'true');
  expect(await input.evaluate(() => window.getSelection()?.anchorOffset)).toBe(
    'Call John at 3pm tomorrow'.length
  );
  await expect(
    page.getByRole('button', { name: 'Edit event start date and time' })
  ).toContainText('3:00');
  await expect(
    page.getByRole('button', { name: 'Guests', exact: true })
  ).toBeVisible();
  await input.press('Enter');
  await expect(input).toHaveText('Call John at 3pm tomorrow\n');
  await expect(page.getByTestId('submission-count')).toHaveText('0');
  await input.press('ControlOrMeta+z');
  await expect(input).toHaveText('Call John at 3pm tomorrow');
  await expect(
    page.getByRole('button', { name: 'Create event', exact: true })
  ).toBeEnabled();
  await page.screenshot({
    path: '/tmp/universal-input-calendar.png',
    fullPage: true,
  });
});

test('locks edited fields, recovers the draft, and submits the visible event once', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('Call John at 3pm tomorrow');
  const submit = page.getByRole('button', {
    name: 'Create event',
    exact: true,
  });
  await expect(submit).toBeEnabled();
  await page.getByLabel('Title', { exact: true }).fill('Call Jane');
  await expect(page.getByLabel('Content type')).toHaveValue('calendar');
  await input.fill('Email John instead');
  await expect(submit).toBeEnabled();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Call Jane'
  );
  await page.reload();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Call Jane'
  );
  await expect(submit).toBeEnabled();
  await input.press('ControlOrMeta+Enter');
  await expect(page.getByTestId('submission-count')).toHaveText('1');
  await expect(page.getByTestId('last-submission')).toContainText('Call Jane');
  await expect(input).toHaveText('');
});

test('shows outgoing email content and recipient before sending', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('textbox', { name: 'Your input', exact: true })
    .fill('Email John that I’ll be late');
  await expect(
    page.getByRole('button', { name: 'Send email', exact: true })
  ).toBeEnabled();
  await expect(page.getByLabel('Outgoing message')).toHaveText('I’ll be late');
  await expect(page.getByText('John Adams', { exact: true })).toBeVisible();
  await expect(page.getByTestId('submission-count')).toHaveText('0');
  await page.screenshot({
    path: '/tmp/universal-input-email.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Send email', exact: true }).click();
  await expect(page.getByTestId('submission-count')).toHaveText('1');
  await expect(page.getByTestId('last-submission')).toContainText(
    'I’ll be late'
  );
  await expect(
    page.getByRole('textbox', { name: 'Your input', exact: true })
  ).toHaveText('');
});

for (const example of [
  { text: 'Email John that I’ll be late', action: 'Send email' },
  { text: 'Call John at 3pm tomorrow', action: 'Create event' },
]) {
  test(`connects Google before ${example.action} and keeps the draft`, async ({
    page,
  }) => {
    await page.goto('/?disconnected');
    const input = page.getByRole('textbox', {
      name: 'Your input',
      exact: true,
    });
    await input.fill(example.text);
    const submit = page.getByRole('button', {
      name: example.action,
      exact: true,
    });
    await expect(submit).toBeDisabled();
    await page
      .getByRole('button', { name: 'Connect Google', exact: true })
      .click();
    await expect(page.getByTestId('connection-count')).toHaveText('1');
    await expect(input).toHaveText(example.text);
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByTestId('submission-count')).toHaveText('1');
    await expect(input).toHaveText('');
  });
}

test('refines an optimistic email into the classified task without a manual type choice', async ({
  page,
}) => {
  await page.goto('/?classification=task&classify-delay=1500');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('Email notifications not working\npriority urgent');
  const type = page.getByLabel('Content type').locator('option:checked');
  await expect(type).toHaveText('Auto · Email');
  await expect(type).toHaveText('Auto · Task');
  await expect(
    page.getByRole('button', { name: 'Create task', exact: true })
  ).toBeEnabled();
  await expect(input).toBeFocused();
});

test('chooses a close-scoring task during typing and cycles alternatives without losing editor focus', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await expect(input).toBeVisible();
  const typing = input.pressSequentially(
    'notification click not going to target',
    { delay: 60 }
  );
  await expect(
    page.getByLabel('Content type').locator('option:checked')
  ).toHaveText('Auto · Task');
  expect((await input.textContent())?.length).toBeLessThan(
    'notification click not going to target'.length
  );
  await typing;
  await input.press('ControlOrMeta+Shift+ArrowRight');
  await expect(page.getByLabel('Content type')).toHaveValue('note');
  await expect(input).toBeFocused();
  await input.press('ControlOrMeta+Shift+ArrowLeft');
  await expect(page.getByLabel('Content type')).toHaveValue('task');
});

test('shows the AM/PM assumption and lets a manual start edit override it', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('textbox', { name: 'Your input', exact: true })
    .fill('call with Julia tomorrow at 7');
  const start = page.getByRole('button', {
    name: 'Edit event start date and time',
  });
  await expect(start).toContainText('7:00');
  await expect(
    page.getByText('Assumed 7:00 PM.', { exact: false })
  ).toBeVisible();
  await start.click();
  const time = page.getByLabel('Start time', { exact: true });
  await time.fill('07:00');
  await time.press('Enter');
  await time.press('Escape');
  await expect(
    page.getByText('Assumed 7:00 PM.', { exact: false })
  ).not.toBeVisible();
  await expect(start).toContainText('7:00 AM');
});

test('refocuses after the message action button and when Home is clicked again', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('DM John that I’ll be late');
  const send = page.getByRole('button', { name: 'Send message', exact: true });
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByTestId('submission-count')).toHaveText('1');
  await expect(input).toHaveText('');
  await expect(input).toBeFocused();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(input).toBeFocused();
});

test('Home starts a blank focused draft and discards saved fields and undo history', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('Call John at 3pm tomorrow');
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Call John'
  );
  await page.getByLabel('Title', { exact: true }).fill('Edited event');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(input).toHaveText('');
  await expect(input).toBeFocused();
  await expect(page.getByLabel('Title', { exact: true })).not.toBeVisible();
  await input.press('ControlOrMeta+z');
  await expect(input).toHaveText('');
  await page.reload();
  await expect(input).toHaveText('');
  await input.fill('Email John that I’ll be late');
  await expect(
    page.getByRole('button', { name: 'Send email', exact: true })
  ).toBeEnabled();
  await expect(page.getByLabel('Content type')).toHaveValue('');
});

test('Home keeps the input blank after pending inference finishes', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('Call John at 3pm tomorrow');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(input).toHaveText('');
  await page.waitForTimeout(600);
  await expect(input).toHaveText('');
  await expect(input).toBeFocused();
  await expect(page.getByLabel('Title', { exact: true })).not.toBeVisible();
  await expect(page.getByTestId('submission-count')).toHaveText('0');
});

test('keeps note tags with the draft through inference, switching modes, and reload', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('Research notes');
  await page
    .getByRole('button', { name: 'Change or select tags', exact: true })
    .click();
  await page.getByText('Launch', { exact: true }).click();
  await input.click();
  await input.fill('Research notes with more detail');
  await expect(
    page.getByRole('button', { name: 'Change or select tags', exact: true })
  ).toContainText('Launch');
  await page.getByLabel('Content type').selectOption('task');
  await page.getByLabel('Content type').selectOption('note');
  await expect(
    page.getByRole('button', { name: 'Change or select tags', exact: true })
  ).toContainText('Launch');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Change or select tags', exact: true })
  ).toContainText('Launch');
  const send = page.getByRole('button', { name: 'Create note', exact: true });
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByTestId('last-submission')).toContainText('launch');
});

test('uses the shared AI picker and exposes its real connection and creation actions', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('textbox', { name: 'Your input', exact: true })
    .fill('Help me plan the launch');
  await page.getByLabel('Content type').selectOption('ai');
  const picker = page.getByRole('button', { name: 'Agent', exact: true });
  await picker.click();
  await page.getByRole('menuitem', { name: /Cursor/ }).click();
  await expect(page.getByTestId('agent-action')).toContainText('connect:');
  await picker.click();
  await page
    .getByRole('menuitem', { name: 'Create agent', exact: true })
    .click();
  await expect(page.getByTestId('agent-action')).toHaveText('create');
});

test('uses the shared legacy model picker and submits the chosen model', async ({
  page,
}) => {
  await page.goto('/?legacy');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('Help me plan the launch');
  await page.getByLabel('Content type').selectOption('ai');
  await page.getByRole('button', { name: 'Model', exact: true }).click();
  await page.getByRole('menuitem', { name: /GPT-5/ }).click();
  await input.press('ControlOrMeta+Enter');
  await expect(page.getByTestId('last-submission')).toContainText('gpt-5');
});

test('searches while typing through Command K and opens the current keyboard result', async ({
  page,
}) => {
  await page.goto('/?classify-delay=3000&extract-delay=3000');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('find investor');
  const results = page.getByRole('listbox', {
    name: 'Search results',
    exact: true,
  });
  await expect(results.getByRole('option')).toHaveText([
    'Search for “investor”',
    'Investor update',
  ]);
  await expect(input).toBeFocused();
  await expect(page.getByTestId('extraction-count')).toHaveText('0');
  await input.press('ArrowDown');
  await expect(results.getByRole('option', { selected: true })).toHaveText(
    'Investor update'
  );
  await input.fill('find hiring');
  await expect(results.getByRole('option')).toHaveText([
    'Search for “hiring”',
    'Hiring plan',
  ]);
  await expect(results.getByRole('option', { selected: true })).toHaveCount(0);
  await expect(page.getByTestId('search-queries')).toContainText('"hiring"');
  await input.press('ArrowDown');
  await expect(results.getByRole('option', { selected: true })).toHaveText(
    'Hiring plan'
  );
  await expect(input).toBeFocused();
  await input.press('Shift+Enter');
  await expect(page.getByTestId('opened-search-result')).toHaveText(
    JSON.stringify({
      content: { type: 'md', id: 'search-document-1' },
      options: { referredFrom: 'home', preferNewSplit: true },
    })
  );
  await expect(page.getByTestId('submission-count')).toHaveText('0');
});

test('search hotkeys leave the type selector and action button native keys intact', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  const type = page.getByLabel('Content type');
  await input.fill('find investor');
  await type.selectOption('search');
  const results = page.getByRole('listbox', {
    name: 'Search results',
    exact: true,
  });
  await expect(
    results.getByRole('option', { name: 'Investor update', exact: true })
  ).toBeVisible();
  await type.focus();
  await type.press('ArrowUp');
  await expect(type).toHaveValue('ai');
  await type.selectOption('search');
  await expect(
    results.getByRole('option', { name: 'Investor update', exact: true })
  ).toBeVisible();
  await input.focus();
  await input.press('ArrowDown');
  await expect(results.getByRole('option', { selected: true })).toHaveText(
    'Investor update'
  );
  const action = page.getByRole('button', {
    name: 'Search Macro',
    exact: true,
  });
  await action.focus();
  await action.press('Enter');
  await expect(page.getByTestId('submission-count')).toHaveText('1');
  await expect(page.getByTestId('opened-search-result')).toHaveText('');
});

test('manual search queries override continued typing and results open directly', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('find hiring');
  await page
    .getByRole('textbox', { name: 'Search for', exact: true })
    .fill('investor');
  await input.fill('find hiring plan');
  const results = page.getByRole('listbox', {
    name: 'Search results',
    exact: true,
  });
  await expect(results.getByRole('option')).toHaveText([
    'Search for “investor”',
    'Investor update',
  ]);
  const query = page.getByRole('textbox', { name: 'Search for', exact: true });
  await query.focus();
  await query.press('ArrowDown');
  await expect(results.getByRole('option', { selected: true })).toHaveText(
    'Investor update'
  );
  await expect(query).toBeFocused();
  await results
    .getByRole('option', { name: 'Investor update', exact: true })
    .click();
  await expect(page.getByTestId('opened-search-result')).toHaveText(
    JSON.stringify({
      content: { type: 'md', id: 'search-document-0' },
      options: { referredFrom: 'home', preferNewSplit: false },
    })
  );
});

test('offers full search above the matching agent session using Command K rows', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your input', exact: true });
  await input.fill('how blowholes work');
  await page.getByLabel('Content type').selectOption('search');
  const results = page.getByRole('listbox', {
    name: 'Search results',
    exact: true,
  });
  await expect(results.getByRole('option')).toHaveText([
    'Search for “how blowholes work”',
    'How Blowholes Work',
  ]);
  await results
    .getByRole('option', { name: 'How Blowholes Work', exact: true })
    .click();
  await expect(page.getByTestId('opened-search-result')).toHaveText(
    JSON.stringify({
      content: { type: 'agent', id: 'search-agent-session' },
      options: { referredFrom: 'home', preferNewSplit: false },
    })
  );
  await results
    .getByRole('option', {
      name: 'Search for “how blowholes work”',
      exact: true,
    })
    .click();
  await expect
    .poll(async () =>
      JSON.parse(await page.getByTestId('opened-search-result').innerText())
    )
    .toMatchObject({
      content: {
        type: 'component',
        id: 'search',
        params: { initialQuery: 'how blowholes work' },
      },
    });
});

test('Command K still searches, opens its selected result, and closes the modal', async ({
  page,
}) => {
  await page.goto('/?command-menu');
  await page
    .getByRole('button', { name: 'Open Command K', exact: true })
    .click();
  const search = page.getByPlaceholder('Search...', { exact: true });
  await expect(search).toBeFocused();
  await search.fill('investor');
  const results = page.getByRole('listbox', {
    name: 'Search results',
    exact: true,
  });
  await expect(
    results.getByRole('option', { name: 'Investor update', exact: true })
  ).toBeVisible();
  await expect(results.getByRole('option', { selected: true })).toHaveText(
    'Investor update'
  );
  await search.press('Enter');
  await expect(page.getByTestId('opened-search-result')).toHaveText(
    JSON.stringify({
      content: { type: 'md', id: 'search-document-0' },
      options: { referredFrom: 'kommand-menu', preferNewSplit: false },
    })
  );
  await expect(search).not.toBeVisible();
});
