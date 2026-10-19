import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { agentsGuides } from '../content/feature-guides/agents';
import { callsGuides } from '../content/feature-guides/calls';
import { channelsGuides } from '../content/feature-guides/channels';
import { crmGuides } from '../content/feature-guides/crm';
import { documentsGuides } from '../content/feature-guides/documents';
import { emailGuides } from '../content/feature-guides/email';
import { githubGuides } from '../content/feature-guides/github';
import { tasksGuides } from '../content/feature-guides/tasks';
import { ProductFeatureDetails } from './ProductFeatureDetails';
import * as productPreview from './productPagePreview';

let motionStyle: HTMLStyleElement;
beforeEach(() => {
  // JSDOM returns an empty animation-name; Kobalte expects the browser's 'none'.
  motionStyle = document.createElement('style');
  motionStyle.textContent =
    '.product-detail-panel, .product-detail-backdrop { animation-name: none; }';
  document.head.append(motionStyle);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

it('uses Back inside a homepage preview and preserves the underlying page', async () => {
  vi.spyOn(productPreview, 'isEmbeddedProductPage').mockReturnValue(true);
  render(() => (
    <>
      <input aria-label="Demo draft" value="My edited brief" />
      <ProductFeatureDetails
        section="Write with your agent"
        details={[
          {
            title: 'Edit together',
            summary: 'Work in the same shared document.',
            intro: 'Changes merge as your team writes.',
            sections: [],
            links: [],
          },
        ]}
      />
    </>
  ));
  const draft = screen.getByRole('textbox', { name: 'Demo draft' });
  const card = screen.getByRole('button', { name: 'Edit together' });
  fireEvent.click(card);
  expect(
    await screen.findByRole('dialog', { name: 'Edit together' })
  ).toBeTruthy();
  const back = screen.getByRole('button', { name: 'Back to product page' });
  await waitFor(() => expect(document.activeElement).toBe(back));
  expect(
    screen.queryByRole('button', { name: 'Close feature details' })
  ).toBeNull();
  fireEvent.click(back);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(card));
  expect(screen.getByRole('textbox', { name: 'Demo draft' })).toBe(draft);
  expect(draft.getAttribute('value')).toBe('My edited brief');
});
afterEach(() => {
  cleanup();
  motionStyle.remove();
  vi.restoreAllMocks();
});

it('shows the selected detail in a drawer and restores its trigger on close', async () => {
  render(() => (
    <ProductFeatureDetails
      section="Move through your inbox"
      details={[
        {
          title: 'Navigate with J and K',
          summary: 'Navigate without the mouse.',
          intro: 'Move between conversations.',
          sections: [],
          links: [],
        },
        {
          title: 'Mark it done',
          summary: 'Clear completed conversations.',
          intro: 'Press E to mark the conversation done.',
          sections: [],
          links: [],
        },
      ]}
    />
  ));
  const navigate = screen.getByRole('button', {
    name: 'Navigate with J and K',
  });
  const done = screen.getByRole('button', { name: 'Mark it done' });
  fireEvent.click(navigate);
  expect(
    await screen.findByRole('dialog', { name: 'Navigate with J and K' })
  ).toBeTruthy();
  expect(screen.getByText('Move between conversations.')).toBeTruthy();
  const close = screen.getByRole('button', { name: 'Close feature details' });
  await waitFor(() => expect(document.activeElement).toBe(close));
  fireEvent.click(close);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(navigate));

  fireEvent.click(done);
  const dialog = await screen.findByRole('dialog', { name: 'Mark it done' });
  expect(
    screen.getByText('Press E to mark the conversation done.')
  ).toBeTruthy();
  expect(screen.queryByText('Move between conversations.')).toBeNull();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(done));
});

it('opens a complete guide with its example, steps, and direct documentation links', async () => {
  render(() => (
    <ProductFeatureDetails
      section="Write with your agent"
      details={documentsGuides['document-agents']}
    />
  ));
  fireEvent.click(screen.getByRole('button', { name: 'Update from an email' }));
  const dialog = await screen.findByRole('dialog', {
    name: 'Update from an email',
  });
  expect(screen.getByRole('heading', { name: 'Example prompt' })).toBeTruthy();
  expect(
    screen.getByRole('heading', { name: 'From request to revision' })
  ).toBeTruthy();
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  expect(screen.getByRole('heading', { name: 'Access' })).toBeTruthy();
  const guide = screen.getByRole('region', { name: 'Feature guide' });
  guide.focus();
  expect(document.activeElement).toBe(guide);
  const docs = screen.getByRole('link', { name: 'Document editing' });
  expect(docs.getAttribute('href')).toBe('https://docs.macro.com/product/docs');
  expect(docs.getAttribute('target')).toBe('_blank');
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Edit together' }));
  await screen.findByRole('dialog', { name: 'Edit together' });
  expect(
    screen.getByRole('heading', { name: 'Feedback and history' })
  ).toBeTruthy();
  expect(screen.getByText('Comments', { selector: 'dt' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Example prompt' })).toBeNull();
});

it('labels an agent prompt separately from instructions and sample human messages', async () => {
  render(() => (
    <ProductFeatureDetails section="Email" details={emailGuides['auto-tags']} />
  ));
  fireEvent.click(screen.getByRole('button', { name: 'Organize with tags' }));
  const dialog = await screen.findByRole('dialog', {
    name: 'Organize with tags',
  });
  const prompt = within(dialog).getByRole('region', { name: 'Example prompt' });
  expect(
    within(prompt).getByText(
      'Tag this customer thread and the rollout plan with the same project tag.'
    )
  ).toBeTruthy();
  expect(within(prompt).queryByRole('textbox')).toBeNull();
  expect(within(prompt).queryByRole('button')).toBeNull();
  expect(within(dialog).queryByText('Ask an agent to help')).toBeNull();
  expect(
    within(dialog).queryByText(/An agent can apply tags when you ask/)
  ).toBeNull();
  expect(
    within(dialog).getByRole('heading', { name: 'Add or change tags' })
  ).toBeTruthy();
});

it.each([
  ['Email', emailGuides],
  ['Chat', channelsGuides],
  ['Documents', documentsGuides],
  ['Agents', agentsGuides],
  ['Calls', callsGuides],
  ['CRM', crmGuides],
  ['Tasks', tasksGuides],
  ['GitHub', githubGuides],
] as const)(
  'opens each %s guide and returns to its card',
  async (section, groups) => {
    const details = Object.values(groups).flat();
    render(() => <ProductFeatureDetails section={section} details={details} />);
    for (const detail of details) {
      const card = screen.getByRole('button', {
        name: detail.title,
      });
      fireEvent.click(card);
      const dialog = await screen.findByRole('dialog', {
        name: detail.title,
      });
      expect(within(dialog).getByText(detail.intro)).toBeTruthy();
      expect(within(dialog).getAllByRole('link').length).toBeGreaterThan(0);
      fireEvent.keyDown(dialog, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(card));
    }
  }
);
