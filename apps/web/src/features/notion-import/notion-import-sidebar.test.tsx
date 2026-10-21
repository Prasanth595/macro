import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { createStore } from 'solid-js/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotionImportSidebar } from './notion-import-sidebar';

const [report, setReport] = createStore<{
  isPending: boolean;
  data: { status?: string | null } | undefined;
}>({ isPending: true, data: undefined });
let scope = 0;
const host = vi.hoisted(() => ({
  userId: '',
  openChatWithMessage: vi.fn(async (_message: string) => {}),
}));
vi.mock('@core/context/user', () => ({ useUserId: () => () => host.userId }));
vi.mock('@queries/import', () => ({
  useNotionImportReportQuery: () => report,
}));
vi.mock('@app/features/chat/ChatWithAgentButton', () => ({
  openChatWithMessage: host.openChatWithMessage,
}));
vi.mock('@ui', () => ({
  Button: (props: JSX.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
}));

beforeEach(() => {
  scope += 1;
  host.userId = `notion-user-${scope}`;
  host.openChatWithMessage.mockClear();
  setReport({ isPending: false, data: { status: null } });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Notion import sidebar', () => {
  it('stays hidden while the report loads, then shows when no import has run', () => {
    setReport({ isPending: true, data: undefined });
    render(() => <NotionImportSidebar />);
    expect(screen.queryByText('Bring Notion to Macro')).toBeNull();
    setReport({ isPending: false, data: { status: null } });
    expect(screen.getByText('Bring Notion to Macro')).toBeTruthy();
    expect(screen.getByText('Bring over pages and databases.')).toBeTruthy();
  });

  it.each([
    'running',
    'ready',
    'importing',
    'completed',
    'failed',
    'dismissed',
  ])('stays hidden once an import has started: %s', (status) => {
    setReport('data', { status });
    render(() => <NotionImportSidebar />);
    expect(screen.queryByText('Bring Notion to Macro')).toBeNull();
  });

  it('dismisses for this user and stays dismissed after remount', () => {
    const view = render(() => <NotionImportSidebar />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss Notion import' })
    );
    expect(screen.queryByText('Bring Notion to Macro')).toBeNull();
    view.unmount();
    render(() => <NotionImportSidebar />);
    expect(screen.queryByText('Bring Notion to Macro')).toBeNull();
    cleanup();
    host.userId = 'another-user';
    render(() => <NotionImportSidebar />);
    expect(screen.getByText('Bring Notion to Macro')).toBeTruthy();
  });

  it('opens an agent chat that asks to import from Notion', () => {
    render(() => <NotionImportSidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'Import from Notion' }));
    expect(host.openChatWithMessage).toHaveBeenCalledWith(
      'Import my Notion workspace into Macro.'
    );
  });
});
