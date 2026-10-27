import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal, type ParentProps } from 'solid-js';
import { afterEach, expect, it, vi } from 'vitest';
import type { ItemListSource } from '../context/crm-sources';
import { RecordItemList } from './record-item-list';

const mounted = vi.hoisted(() => vi.fn());

vi.mock('@entity', () => ({
  ListEntity: (props: {
    entity: { name: string };
    referencePropertyIds?: readonly string[];
  }) => {
    mounted(props.referencePropertyIds);
    return <div>{props.entity.name}</div>;
  },
  ListEntityMetadataQueryProvider: (props: ParentProps) => props.children,
  ListLayoutProvider: (props: ParentProps) => props.children,
}));
vi.mock('@ui', () => ({
  Button: (props: ParentProps<{ onClick: () => void }>) => (
    <button type="button" onClick={props.onClick}>
      {props.children}
    </button>
  ),
}));
vi.mock('../../../lib/primitives/infinite-scroll-sentinel', () => ({
  useInfiniteScrollSentinel: vi.fn(),
}));
vi.mock('../context/crm-context', () => ({
  useCrmContext: () => ({
    createNavigation: () => ({ openEntity: vi.fn() }),
  }),
}));

afterEach(cleanup);

function source(overrides: Partial<ItemListSource>): ItemListSource {
  return {
    isPending: false,
    isEnabled: true,
    isLoading: false,
    data: {
      entities: [{ id: 'doc-1', name: 'Kickoff notes' }] as never,
    },
    hasNextPage: false,
    isFetchingNextPage: false,
    isError: false,
    isFetchNextPageError: false,
    fetchNextPage: vi.fn(async () => undefined),
    refetch: vi.fn(async () => undefined),
    ...overrides,
  };
}

it('replaces cached rows and retries the query after a failed refetch', () => {
  const failed = source({ isError: true });
  render(() => <RecordItemList source={failed} empty="Nothing" />);

  expect(screen.queryByText('Kickoff notes')).toBeNull();
  screen.getByText("Couldn't load this list.");
  fireEvent.click(screen.getByText('Retry'));
  expect(failed.refetch).toHaveBeenCalledTimes(1);
  expect(failed.fetchNextPage).not.toHaveBeenCalled();
});

it('keeps loaded rows and retries the page after a failed continuation', () => {
  const failed = source({ isFetchNextPageError: true, hasNextPage: true });
  render(() => <RecordItemList source={failed} empty="Nothing" />);

  screen.getByText('Kickoff notes');
  screen.getByText("Couldn't load more.");
  fireEvent.click(screen.getByText('Retry'));
  expect(failed.fetchNextPage).toHaveBeenCalledTimes(1);
  expect(failed.refetch).not.toHaveBeenCalled();
});

it('searches titles and supporting text without dropping pagination', () => {
  const list = source({
    data: {
      entities: [
        { id: 'call-1', name: 'Pilot check-in', summary: 'Review adoption' },
        {
          id: 'call-2',
          name: 'Technical deep dive',
          summary: 'Security review',
        },
      ] as never,
    },
    hasNextPage: true,
  });
  render(() => (
    <RecordItemList source={list} search="  REVIEW pilot  " empty="Nothing" />
  ));

  screen.getByText('Pilot check-in');
  expect(screen.queryByText('Technical deep dive')).toBeNull();
  expect(screen.queryByText('No matching items.')).toBeNull();
});

it('only declares no search results after the final page', () => {
  render(() => (
    <RecordItemList
      source={source({ hasNextPage: true })}
      search="missing"
      empty="Nothing"
    />
  ));
  screen.getByText('Searching more…');
  expect(screen.queryByText('No matching items.')).toBeNull();
});

it('retains earlier row nodes when a page appends and updates their content', () => {
  mounted.mockClear();
  const [entities, setEntities] = createSignal([
    { id: 'doc-1', type: 'document', name: 'First page' },
  ]);
  const list = source({ hasNextPage: true });
  Object.defineProperty(list, 'data', {
    get: () => ({ entities: entities() }),
  });
  const view = render(() => (
    <RecordItemList
      source={list}
      empty="Nothing"
      referencePropertyIds={['reference-id']}
    />
  ));
  const first = screen.getByText('First page');
  setEntities([
    { id: 'doc-1', type: 'document', name: 'First page updated' },
    { id: 'doc-2', type: 'document', name: 'Second page' },
  ]);
  expect(screen.getByText('First page updated')).toBe(first);
  screen.getByText('Second page');
  expect(mounted).toHaveBeenCalledTimes(2);
  expect(mounted).toHaveBeenCalledWith(['reference-id']);
  view.unmount();
});
