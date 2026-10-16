import { cleanup, render, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeChatStart } from './HomeChatStart';

type ChildrenProps = { children?: JSX.Element };

const mocks = vi.hoisted(() => ({
  agentsEnabled: true,
  asideCollapsed: false,
  asideOverlay: false,
}));

vi.mock('@app/components/view-shell', () => ({
  useViewShell: () => ({
    aside: {
      isCollapsed: () => mocks.asideCollapsed,
      isOverlay: () => mocks.asideOverlay,
    },
  }),
  ViewShell: {
    TopBar: (props: ChildrenProps) => (
      <div data-testid="home-topbar">{props.children}</div>
    ),
  },
  ViewSidebar: {
    Title: (props: ChildrenProps) => <span>{props.children}</span>,
  },
}));
vi.mock('@app/lib/analytics/posthog', () => ({
  useFeatureFlag: (flag: { key: string }) => () => ({
    enabled: flag.key === 'agents' && mocks.agentsEnabled,
  }),
}));
vi.mock('@core/constant/featureFlags', () => ({
  enableChatV3Agents: { key: 'agents' },
  enableUniversalInput: { key: 'universal' },
}));
vi.mock('@core/context/user', () => ({ useUserId: () => () => 'alice' }));
vi.mock('@core/component/AI/component/DragDrop', () => ({
  DragDropWrapper: (props: ChildrenProps & { class?: string }) => (
    <div data-testid="home-composer-frame" class={props.class}>
      {props.children}
    </div>
  ),
}));
vi.mock('@core/component/AI/context', () => ({
  ChatInputProvider: (props: ChildrenProps) => props.children,
}));
vi.mock('../home-chat-input', () => ({
  HomeChatInput: () => <div data-testid="usual-input" />,
}));
vi.mock('../../universal-input/universal-input', () => ({
  UniversalInput: () => <div data-testid="universal-input" />,
}));
vi.mock('./home-recommended-actions', () => ({
  HomeRecommendedActions: () => <div data-testid="home-suggestions" />,
}));

beforeEach(() => {
  mocks.agentsEnabled = true;
  mocks.asideCollapsed = false;
  mocks.asideOverlay = false;
});
afterEach(cleanup);

function renderHome() {
  return render(() => <HomeChatStart />);
}

describe('Home composer', () => {
  it('starts without an AI greeting', () => {
    renderHome();
    expect(screen.getByTestId('usual-input')).toBeTruthy();
    expect(document.querySelector('h1')).toBeNull();
    expect(document.querySelector('[data-testid="home-topbar"]')).toBeNull();
  });
  it('shows the Home topbar when the list is collapsed', () => {
    mocks.asideCollapsed = true;
    renderHome();
    expect(screen.getByTestId('home-topbar')).toBeTruthy();
    expect(screen.getByTestId('usual-input')).toBeTruthy();
  });
  it('keeps the legacy composer when agents are disabled', () => {
    mocks.agentsEnabled = false;
    renderHome();
    expect(screen.getByTestId('usual-input')).toBeTruthy();
    expect(screen.getByText('What should we get done in Macro?')).toBeTruthy();
  });
});
