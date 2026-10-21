import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorImportProvider } from '../context/connector-import-context';
import { IMPORT_CATEGORIES } from '../core/catalog';
import type { ImportCategory } from '../core/providers';
import {
  fakeConnectorImport,
  importEntity,
  importRunState,
} from '../tests/fake-context';
import { ConnectorImportDialog } from './import-dialog';

vi.mock('@core/mobile/isMobile', () => ({ isMobile: () => false }));
vi.mock('@core/mobile/virtualKeyboard', () => ({
  virtualKeyboardVisible: () => false,
}));
vi.mock('@core/component/Toast/Toast', () => ({
  toast: { failure: vi.fn() },
}));

let motionStyles: HTMLStyleElement;
beforeEach(() => {
  motionStyles = document.createElement('style');
  motionStyles.textContent =
    '* { transition-duration: 0s; animation-name: none; }';
  document.head.append(motionStyles);
  vi.stubGlobal('scrollTo', vi.fn());
});
afterEach(() => {
  cleanup();
  motionStyles.remove();
  vi.unstubAllGlobals();
});

function setup(
  category: ImportCategory,
  options?: Parameters<typeof fakeConnectorImport>[0] & {
    alternative?: () => void;
  }
) {
  const fake = fakeConnectorImport(options);
  const [open, setOpen] = createSignal(true);
  const onImported = vi.fn();
  render(() => (
    <ConnectorImportProvider context={fake.context}>
      <ConnectorImportDialog
        config={IMPORT_CATEGORIES[category]}
        open={open()}
        onOpenChange={setOpen}
        onImported={onImported}
        alternatives={
          options?.alternative && [
            {
              icon: () => <svg />,
              label: 'Upload a CSV',
              description: 'From a spreadsheet.',
              onSelect: options.alternative,
            },
          ]
        }
      />
    </ConnectorImportProvider>
  ));
  return { ...fake, open, onImported };
}

describe('connector import dialog', () => {
  it('lists every provider in the category with its connection state', () => {
    setup('files', { connected: ['dropbox'] });
    for (const provider of IMPORT_CATEGORIES.files.providers) {
      expect(screen.getByText(provider.name)).toBeTruthy();
    }
    expect(
      screen.getByRole('button', { name: 'Import from Dropbox' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Connect Google Drive' })
    ).toBeTruthy();
    expect(screen.getByText(/Encrypted in transit and at rest/)).toBeTruthy();
  });

  it('connects an agent provider, then hands its import to a chat', async () => {
    const { context, open } = setup('tasks');
    fireEvent.click(screen.getByRole('button', { name: 'Connect Jira' }));
    expect(context.connect).toHaveBeenCalledWith(
      { appSlug: 'jira', name: 'Jira' },
      expect.anything()
    );
    const importButton = await screen.findByRole('button', {
      name: 'Import from Jira',
    });
    fireEvent.click(importButton);
    await waitFor(() => expect(open()).toBe(false));
    expect(context.startAgentImport).toHaveBeenCalledWith(
      expect.objectContaining({
        input:
          'Import my most recent issues and tasks from Jira into Macro tasks.',
      })
    );
  });

  it('keeps an unfinished connection disconnected', async () => {
    const fake = setup('crm');
    fake.setConnectOutcome('closed');
    fireEvent.click(screen.getByRole('button', { name: 'Connect HubSpot' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Connect HubSpot' })
      ).toHaveProperty('disabled', false)
    );
    expect(screen.queryByRole('button', { name: 'Import from HubSpot' })).toBe(
      null
    );
  });

  it('hands Notion to the agent flow instead of the generic handoff', async () => {
    const { context, open } = setup('files', { connected: ['notion'] });
    fireEvent.click(screen.getByRole('button', { name: 'Import from Notion' }));
    await waitFor(() => expect(open()).toBe(false));
    expect(context.startAgentFlow).toHaveBeenCalledWith('notion-workspace');
    expect(context.startAgentImport).not.toHaveBeenCalled();
    expect(context.discover).not.toHaveBeenCalled();
  });

  it('starts the Notion agent flow as soon as Notion connects', async () => {
    const { context, open } = setup('files');
    fireEvent.click(screen.getByRole('button', { name: 'Connect Notion' }));
    await waitFor(() => expect(open()).toBe(false));
    expect(context.startAgentFlow).toHaveBeenCalledWith('notion-workspace');
  });

  it('hands Linear to a generic agent chat', async () => {
    const { context, open } = setup('tasks', { connected: ['linear'] });
    fireEvent.click(screen.getByRole('button', { name: 'Import from Linear' }));
    await waitFor(() => expect(open()).toBe(false));
    expect(context.startAgentImport).toHaveBeenCalledWith(
      expect.objectContaining({
        input:
          'Import my most recent issues and tasks from Linear into Macro tasks.',
      })
    );
    expect(context.discover).not.toHaveBeenCalled();
  });

  it('discovers, imports selected native items, and reports confirmed imports', async () => {
    const { context, setState, onImported } = setup('channels', {
      connected: ['slack'],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import from Slack' }));
    expect(screen.getByText('Import from Slack')).toBeTruthy();
    await waitFor(() => expect(context.discover).toHaveBeenCalledWith('slack'));

    setState({
      runs: [importRunState({ source: 'slack', status: 'running' })],
      entities: [],
    });
    expect(screen.getByText(/Finding your recent channels/)).toBeTruthy();

    setState({
      runs: [importRunState({ source: 'slack' })],
      entities: [
        importEntity({
          id: 'a',
          source: 'slack',
          metadata: { name: 'general' },
        }),
        importEntity({
          id: 'b',
          source: 'slack',
          metadata: { name: 'eng' },
        }),
      ],
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /Select #general/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Import 1' }));
    await waitFor(() => expect(context.runImport).toHaveBeenCalledWith(['a']));
    expect(onImported).not.toHaveBeenCalled();

    setState({
      runs: [importRunState({ source: 'slack' })],
      entities: [
        importEntity({
          id: 'a',
          source: 'slack',
          status: 'imported',
          metadata: { name: 'general' },
          entity_id: 'channel-1',
          entity_type: 'channel',
        }),
        importEntity({
          id: 'b',
          source: 'slack',
          metadata: { name: 'eng' },
        }),
      ],
    });
    expect(
      screen
        .getByRole('link', { name: 'Open imported #general' })
        .getAttribute('href')
    ).toBe('/app/channel/channel-1');
    expect(onImported).toHaveBeenCalled();
    expect(context.discover).toHaveBeenCalledTimes(1);
  });

  it('does not rediscover when items are already staged', async () => {
    const fake = fakeConnectorImport({ connected: ['slack'] });
    fake.setState({
      runs: [importRunState({ source: 'slack' })],
      entities: [
        importEntity({
          id: 'x',
          source: 'slack',
          metadata: { name: 'ship-it', member_count: 4 },
        }),
      ],
    });
    render(() => (
      <ConnectorImportProvider context={fake.context}>
        <ConnectorImportDialog
          config={IMPORT_CATEGORIES.channels}
          open
          onOpenChange={() => {}}
          onImported={() => {}}
        />
      </ConnectorImportProvider>
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Import from Slack' }));
    expect(await screen.findByText('#ship-it')).toBeTruthy();
    expect(screen.getByText('4 members')).toBeTruthy();
    expect(fake.context.discover).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to apps' }));
    expect(
      screen.getByRole('button', { name: 'Import from Slack' })
    ).toBeTruthy();
  });

  it('offers the host alternative and closes before running it', async () => {
    const alternative = vi.fn();
    const { open } = setup('crm', { alternative });
    fireEvent.click(screen.getByRole('button', { name: /Upload a CSV/ }));
    expect(alternative).toHaveBeenCalled();
    await waitFor(() => expect(open()).toBe(false));
  });
});
