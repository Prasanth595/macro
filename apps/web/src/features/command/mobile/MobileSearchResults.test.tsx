import type { EntityData, SearchLocation } from '@entity';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { type Accessor, createSignal } from 'solid-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { EntitySearchItem } from '../queries/entity-search';
import { MobileSearchInput } from './MobileSearchInput';
import { MobileSearchResults } from './MobileSearchResults';
import { SearchState } from './mobileSearchState';

const mocks = vi.hoisted(() => ({
  fullText: vi.fn(),
  fullTextItems: [] as EntityData[],
  open: vi.fn(),
  loadMore: vi.fn(),
  items: (() => []) as Accessor<EntitySearchItem[]>,
}));
vi.mock('@app/lib/analytics/posthog', () => ({
  useFeatureFlag: () => () => ({ enabled: true }),
}));
vi.mock('@app/features/crm/record-adapter', () => ({
  useCrmContactDiscovery: vi.fn(),
}));
vi.mock('@app/features/next-soup/utils', () => ({
  openEntityInSplitFromUnifiedList: mocks.open,
}));
vi.mock('@components/app/split-layout/layout', () => ({
  useSplitLayout: () => ({ openWithSplit: mocks.open }),
}));
vi.mock('@components/app/split-layout/layoutUtils', () => ({
  useSplitPanelOrThrow: () => ({ handle: {} }),
}));
vi.mock('@components/app/mobile/use-mobile-nav', () => ({
  useForegroundMobileView: () => () => 'search',
  useMobileNavNavigate: () => vi.fn(),
}));
vi.mock('@core/mobile/haptics', () => ({ hapticImpact: vi.fn() }));
vi.mock(
  '@core/component/LexicalMarkdown/component/core/StaticMarkdown',
  () => ({
    StaticMarkdownContext: (props: {
      children: import('solid-js').JSX.Element;
    }) => props.children,
  })
);
vi.mock('@core/component/Toast/Toast', () => ({ toast: { failure: vi.fn() } }));
vi.mock('@queries/channel/get-or-create-dm', () => ({
  useGetOrCreateDirectMessageMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@queries/storage/databases', () => ({
  useDatabaseDiscoverySync: vi.fn(),
}));
vi.mock('../CommandItem', () => ({
  ItemDisplay: (props: { item: EntitySearchItem }) => (
    <span>{props.item.searchText}</span>
  ),
}));
vi.mock('@entity', () => ({
  ListEntityMetadataQueryProvider: (props: {
    children: import('solid-js').JSX.Element;
  }) => props.children,
  ListLayoutProvider: (props: { children: import('solid-js').JSX.Element }) =>
    props.children,
  ListEntity: (props: {
    entity: EntityData;
    onContentHitClick: (event: MouseEvent, location: SearchLocation) => void;
  }) => (
    <button
      type="button"
      onClick={(event) =>
        props.onContentHitClick(event, {
          type: 'email',
          messageId: 'matching-message',
        })
      }
    >
      {props.entity.name} snippet
    </button>
  ),
}));
vi.mock('../queries/entity-search', () => ({
  useEntitySearch: () => ({
    items: () => mocks.items(),
    rankItems: (items: EntitySearchItem[]) => items,
    isLoadingEntities: () => false,
    pagination: {
      hasMore: () => true,
      isLoadingMore: () => false,
      loadMore: mocks.loadMore,
    },
  }),
}));
vi.mock('../queries/mobile-full-text-search', () => ({
  createMobileFullTextSearch: (...args: unknown[]) => {
    mocks.fullText(...args);
    return {
      data: () => mocks.fullTextItems,
      isLoading: () => false,
      error: () => undefined,
      hasNextPage: () => false,
    };
  },
}));
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(
    document.body
  );
  vi.stubGlobal(
    'ResizeObserver',
    class implements ResizeObserver {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [
            {
              target,
              contentRect: new DOMRect(0, 0, 400, 400),
              borderBoxSize: [],
              contentBoxSize: [],
              devicePixelContentBoxSize: [],
            },
          ],
          this
        );
      }
      unobserve() {}
      disconnect() {}
    }
  );
  mocks.items = () => [];
  mocks.fullTextItems = [];
  SearchState.open();
});
afterEach(() => {
  cleanup();
  SearchState.close();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('offers full text above empty results, only mounts it explicitly, and keeps the input during mode changes', () => {
  render(() => (
    <>
      <MobileSearchInput />
      <MobileSearchResults />
    </>
  ));
  const input = screen.getByPlaceholderText('Search…');
  input.focus();
  fireEvent.input(input, { target: { value: 'teo' } });
  expect(screen.getByText('No results')).toBeTruthy();
  expect(mocks.fullText).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Search full text for “teo”' })
  );
  expect(mocks.fullText).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(input);
  fireEvent.input(input, { target: { value: 'teo update' } });
  expect(SearchState.mode()).toBe('full-text');
  SearchState.setCategory('email');
  expect(mocks.fullText).toHaveBeenCalledOnce();
  fireEvent.input(input, { target: { value: '  ' } });
  expect(SearchState.mode()).toBe('name');
  expect(SearchState.category()).toBe('email');
  expect(screen.queryByText(/Search full text for/)).toBeNull();
  expect(screen.getByPlaceholderText('Search…')).toBe(input);
});

it('omits full text for Projects, exposes pagination, and ends the session on result opening', async () => {
  const [items, setItems] = createSignal<EntitySearchItem[]>([]);
  mocks.items = items;
  render(() => <MobileSearchResults />);
  SearchState.setQuery('teo');
  SearchState.searchFullText();
  SearchState.setCategory('projects');
  expect(screen.queryByText(/Search full text for/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  expect(mocks.loadMore).toHaveBeenCalledOnce();
  setItems([
    {
      id: 'project',
      kind: 'initiative',
      bucket: 'initiative',
      name: 'Teo project',
      searchText: 'Teo project',
      sortTimestamp: 0,
      timestamps: {},
    },
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Teo project' }));
  expect(SearchState.isOpen()).toBe(false);
  expect(mocks.open).toHaveBeenCalled();
  SearchState.open();
  expect(SearchState.mode()).toBe('name');
  expect(SearchState.category()).toBe('all');
});

it('opens the selected full-text message and resets the session', () => {
  const email: EntityData = {
    id: 'thread',
    type: 'email',
    name: 'Weekly update',
    ownerId: 'owner',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    isRead: true,
    isDraft: false,
    isImportant: false,
    done: false,
  };
  mocks.fullTextItems = [email];
  SearchState.setQuery('teo');
  SearchState.setCategory('email');
  SearchState.searchFullText();
  render(() => <MobileSearchResults />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Weekly update snippet' })
  );
  expect(mocks.open).toHaveBeenCalledWith(email, {
    splitHandle: {},
    location: { type: 'email', messageId: 'matching-message' },
  });
  expect(SearchState.isOpen()).toBe(false);
  expect(SearchState.query()).toBe('');
  expect(SearchState.category()).toBe('all');
});

it('bounds mounted recent rows while keeping the first result usable', () => {
  mocks.items = () =>
    Array.from({ length: 2000 }, (_, index) => ({
      id: `project-${index}`,
      kind: 'initiative',
      bucket: 'initiative',
      name: `Project ${index}`,
      searchText: `Project ${index}`,
      sortTimestamp: 0,
      timestamps: {},
    }));
  render(() => <MobileSearchResults />);
  expect(screen.getAllByRole('button').length).toBeLessThan(50);
  fireEvent.click(screen.getByRole('button', { name: 'Project 0' }));
  expect(mocks.open).toHaveBeenCalled();
  expect(SearchState.isOpen()).toBe(false);
});
