import type { Property } from '@property/types';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import type { ParentProps } from 'solid-js';
import { afterEach, expect, it, vi } from 'vitest';

const pills = vi.hoisted(() => ({ canEdit: [] as boolean[] }));
vi.mock('@components/app/side-panel', () => ({
  SidePanel: {
    Layout: (props: ParentProps) => <>{props.children}</>,
    Footer: (props: ParentProps) => <>{props.children}</>,
    Section: (props: ParentProps) => <>{props.children}</>,
  },
}));
vi.mock('@components/app/side-panel/EntityMetadata', () => ({
  EntityMetadata: () => null,
}));
vi.mock('@core/component/InlineTitleEditor', () => ({
  InlineTitleEditor: (props: {
    ariaLabel: string;
    onRename(name: string): void;
  }) => (
    <input
      aria-label={props.ariaLabel}
      onChange={(event) => props.onRename(event.currentTarget.value)}
    />
  ),
}));
vi.mock('@property/component/PropertyValuePill', () => ({
  PropertyValuePill: (props: { property: Property; canEdit: boolean }) => {
    pills.canEdit.push(props.canEdit);
    return <span>{props.property.displayName}</span>;
  },
}));

import { ProjectWorkspace } from './project-workspace';

afterEach(() => {
  cleanup();
  pills.canEdit = [];
});

const project = {
  id: '01992d2f-8444-7000-8000-000000000001',
  name: 'Launch',
  ownerId: 'macro|owner@example.com',
  updatedAt: '2026-09-15T12:00:00Z',
};
const status = { displayName: 'Status' } as Property;

function workspace(
  overrides: Partial<Parameters<typeof ProjectWorkspace>[0]> = {}
) {
  return render(() => (
    <ProjectWorkspace
      project={project}
      properties={[status]}
      section="overview"
      description={<p>Description slot</p>}
      discussion={<p>Discussion slot</p>}
      tasks={<p>Tasks slot</p>}
      {...overrides}
    />
  ));
}

it('shows a viewer without an editor the name and every property read-only', () => {
  workspace();
  expect(screen.getByRole('heading', { name: 'Launch' })).toBeTruthy();
  expect(screen.queryByLabelText('Project name')).toBeNull();
  expect(screen.getByText('Status')).toBeTruthy();
  expect(pills.canEdit).toEqual([false]);
  expect(screen.getByText('Description slot')).toBeTruthy();
  expect(screen.getByText('Discussion slot')).toBeTruthy();
});

it('renames and edits properties through the editor it is given', () => {
  const rename = vi.fn(async () => {});
  workspace({ editor: { rename, saveProperty: vi.fn(async () => {}) } });
  expect(screen.queryByRole('heading', { name: 'Launch' })).toBeNull();
  expect(pills.canEdit).toEqual([true]);
  fireEvent.change(screen.getByLabelText('Project name'), {
    target: { value: 'Relaunch' },
  });
  expect(rename).toHaveBeenCalledWith('Relaunch');
});

it('shows why a rename failed', async () => {
  workspace({
    editor: {
      rename: async () => {
        throw new Error('Name taken');
      },
      saveProperty: vi.fn(async () => {}),
    },
  });
  fireEvent.change(screen.getByLabelText('Project name'), {
    target: { value: 'Relaunch' },
  });
  expect((await screen.findByRole('alert')).textContent).toBe('Name taken');
});

it('fills the tasks section from the host', () => {
  workspace({ section: 'tasks' });
  expect(screen.getByText('Tasks slot')).toBeTruthy();
  expect(screen.queryByText('Description slot')).toBeNull();
});

it('says when the project could not refresh', () => {
  workspace({ refreshFailed: true });
  expect(screen.getByRole('status').textContent).toBe(
    'Could not refresh this project.'
  );
});
