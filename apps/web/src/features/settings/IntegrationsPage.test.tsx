/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, expect, it, vi } from 'vitest';
import { IntegrationsPage } from './IntegrationsPage';

const openSettings = vi.fn();
vi.mock('@core/constant/SettingsState', () => ({
  useSettingsState: () => ({ openSettings }),
}));
vi.mock('@core/constant/featureFlags', () => ({ ENABLE_EMAIL: true }));
vi.mock('@core/pipedream/flag', () => ({
  usePipedreamMcpFlag: () => () => true,
}));
vi.mock('./Email', () => ({ EmailCard: () => <div>Email</div> }));
vi.mock('./GitHub', () => ({ GitHubCard: () => <div>GitHub</div> }));
vi.mock('./Integrations', () => ({ IntegrationsSection: () => null }));
vi.mock('./connections/integrations-view', () => ({
  IntegrationsView: (props: { onOpenLocalAgents: () => void }) => (
    <div>
      <h1>Integrations</h1>
      <button type="button" onClick={props.onOpenLocalAgents}>
        Set up local agents
      </button>
    </div>
  ),
}));
vi.mock('./Harness', () => ({
  Harness: (props: { onBack?: () => void; backLabel?: string }) => (
    <div>
      <h1>Runtimes</h1>
      <button type="button" onClick={props.onBack}>
        {props.backLabel}
      </button>
    </div>
  ),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('returns local-agent setup to Integrations without opening the Agents settings route', () => {
  render(() => <IntegrationsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Set up local agents' }));
  expect(screen.getByRole('heading', { name: 'Runtimes' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Integrations' }));
  expect(screen.getByRole('heading', { name: 'Integrations' })).toBeTruthy();
  expect(openSettings).not.toHaveBeenCalled();
});
