import { cleanup, render, screen } from '@solidjs/testing-library';
import type { Accessor } from 'solid-js';
import { afterEach, expect, it, vi } from 'vitest';

const doubles = vi.hoisted(() => ({
  session: vi.fn((_projectId: string, _grant: string, _next: unknown) => ({
    connectionError: () => undefined,
    dispose: () => {},
  })),
  canEdit: [] as boolean[],
}));
vi.mock('../queries/public-project-description', () => ({
  createPublicProjectDescriptionSession: doubles.session,
}));
vi.mock('../queries/production-project-description', () => ({
  createProductionProjectDescriptionSession: () => {
    throw new Error('a visitor never ensures the surface');
  },
}));
vi.mock('@core/collab-surface/CollabMarkdownEditor', () => ({
  CollabMarkdownEditor: (props: { canEdit: Accessor<boolean> }) => {
    doubles.canEdit.push(props.canEdit());
    return <div>Description editor</div>;
  },
}));
vi.mock('../queries/public-project', () => ({
  nextPublicDescriptionGrant: vi.fn(),
}));

import { nextPublicDescriptionGrant } from '../queries/public-project';
import { PublicProjectDescription } from './public-project-description';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  doubles.canEdit = [];
});

it('shows a description no one has written as none, without opening it', () => {
  render(() => (
    <PublicProjectDescription
      projectId="project-1"
      description={{ state: 'empty' }}
    />
  ));
  expect(screen.getByText('No description')).toBeTruthy();
  expect(screen.queryByText('Description editor')).toBeNull();
  expect(doubles.session).not.toHaveBeenCalled();
});

it('opens a live description read-only with the project grant', () => {
  render(() => (
    <PublicProjectDescription
      projectId="project-1"
      description={{ state: 'live', token: 'grant-1' }}
    />
  ));
  expect(screen.getByText('Description editor')).toBeTruthy();
  expect(doubles.session).toHaveBeenCalledWith(
    'project-1',
    'grant-1',
    nextPublicDescriptionGrant
  );
  expect(doubles.canEdit).toEqual([false]);
});
