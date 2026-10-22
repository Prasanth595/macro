import type { TagSetResponse } from '@service-properties/generated/schemas/tagSetResponse';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/solid-query';
import { createEditor } from 'lexical';
import { type ParentProps, Suspense } from 'solid-js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import { INSERT_TAG_MENTION_COMMAND } from '../../plugins/tags';
import { createMenuOperations } from '../../shared/inlineMenu';
import { TagsMenu } from './TagsMenu';

const mocks = vi.hoisted(() => ({
  team: vi.fn(),
  tags: [] as TagSetResponse[],
  ensure: vi.fn((..._args: unknown[]) => ({ isPending: false })),
}));
vi.mock('@queries/team/teams', () => ({
  useCurrentTeamQuery: () => mocks.team(),
}));
vi.mock('@queries/properties/tags', () => ({
  useTagsQuery: () => ({ data: mocks.tags }),
  useEnsureTagSetMutation: (...args: unknown[]) => mocks.ensure(...args),
  invalidateTags: vi.fn(),
}));
vi.mock('@queries/properties/options', () => ({
  useAddPropertyOptionMutation: () => ({ isPending: false }),
}));
vi.mock('./useMenuKeyboardNavigation', () => ({
  useMenuKeyboardNavigation: vi.fn(),
}));
vi.mock('./InlineFollowupMenu', () => ({ InlineFollowupMenu: () => null }));
vi.mock('@core/component/ScopedPortal', () => ({
  ScopedPortal: (props: ParentProps) => props.children,
}));
vi.mock('../../directive/floatWithSelection', () => ({
  floatWithSelection: vi.fn(),
}));
vi.mock('../../plugins', () => ({
  CLOSE_INLINE_SEARCH_COMMAND: {},
  REMOVE_INLINE_SEARCH_COMMAND: {},
}));
vi.mock('../../plugins/tags', () => ({ INSERT_TAG_MENTION_COMMAND: {} }));
vi.mock('@property/tags/TagDot', () => ({ TagDot: () => null }));
vi.mock('@ui', () => ({
  Surface: (props: ParentProps) => <div>{props.children}</div>,
}));

const clients: QueryClient[] = [];
beforeEach(() => {
  mocks.tags = [];
  mocks.ensure.mockClear();
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
});

describe('closed inline tags menu', () => {
  it.each([true, false])(
    'does not suspend its editor on missing team metadata (enabled=%s)',
    (enabled) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      clients.push(client);
      mocks.team.mockImplementation(() =>
        useQuery(() => ({
          queryKey: ['team-test'],
          enabled,
          queryFn: () => new Promise(() => {}),
        }))
      );
      function Editor() {
        const menu = createMenuOperations();
        return (
          <div data-testid="editor">
            Cached body
            <TagsMenu editor={createEditor()} menu={menu} />
          </div>
        );
      }
      render(() => (
        <QueryClientProvider client={client}>
          <Suspense fallback={<div data-testid="loading" />}>
            <Editor />
          </Suspense>
        </QueryClientProvider>
      ));
      expect(screen.getByTestId('editor').textContent).toBe('Cached body');
      expect(screen.queryByTestId('loading')).toBeNull();
    }
  );
});

describe('tag mention identities', () => {
  it('only inserts committed tags into collaborative content', () => {
    const scroll = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView'
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    onTestFinished(() => {
      if (scroll)
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scroll);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    });
    const definitionId = '019ce2bb-e97e-7fdb-b6b4-d6b36fbe9da0';
    const optionId = '019ce2bb-e97e-7fdb-b6b4-d6b36fbe9da1';
    const pendingId = 'd0626d76-ab07-4c61-8cd4-4c2517789c46';
    mocks.team.mockReturnValue({ isPending: true });
    mocks.tags = [
      {
        scope: 'user',
        definition: null,
        options: [
          {
            id: pendingId,
            propertyDefinitionId: definitionId,
            displayOrder: 0,
            value: { type: 'string', value: 'Pending option' },
            color: null,
          },
          {
            id: optionId,
            propertyDefinitionId: pendingId,
            displayOrder: 0,
            value: { type: 'string', value: 'Pending definition' },
            color: null,
          },
          {
            id: optionId,
            propertyDefinitionId: definitionId,
            displayOrder: 0,
            value: { type: 'string', value: 'Committed tag' },
            color: null,
          },
        ],
      },
    ];
    const editor = createEditor();
    const dispatch = vi.spyOn(editor, 'dispatchCommand');
    const menu = createMenuOperations();
    menu.openMenu();
    render(() => <TagsMenu editor={editor} menu={menu} />);
    expect(screen.queryByRole('button', { name: 'Pending option' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Pending definition' })
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Committed tag' }));
    expect(
      dispatch.mock.calls.filter(
        ([command]) => command === INSERT_TAG_MENTION_COMMAND
      )
    ).toEqual([
      [
        INSERT_TAG_MENTION_COMMAND,
        {
          optionId,
          propertyDefinitionId: definitionId,
          scope: 'user',
          name: 'Committed tag',
          color: undefined,
        },
      ],
    ]);
    // Inline creation must use the canonical REST ensure before REST add-option.
    expect(mocks.ensure).toHaveBeenCalledWith(undefined, {
      requireCanonical: true,
    });
  });
});
