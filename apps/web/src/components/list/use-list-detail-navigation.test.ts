import { createRoot, createSignal } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { useListDetailNavigation } from './use-list-detail-navigation';

type Row = { key: string; entity?: { id: string }; load?: () => Promise<void> };
describe('detail navigation through grouped page boundaries', () => {
  it.each([undefined, 'b:1'])(
    'anchors details to the open entity when focus is %s',
    async (focus) => {
      await createRoot(async (dispose) => {
        const rows: Row[] = ['a', 'b', 'c'].map((id) => ({
          key: `${id}:1`,
          entity: { id },
        }));
        const open = vi.fn();
        const navigation = useListDetailNavigation({
          currentId: () => 'a',
          currentKey: () => focus,
          getKey: (row) => row.key,
          source: {
            items: () => rows,
            hasMore: () => false,
            loadMore: async () => {},
            error: () => undefined,
          },
          getEntity: (row) => row.entity,
          open,
        });
        await navigation.navigate(1);
        expect(open).toHaveBeenCalledWith(rows[1].entity);
        dispose();
      });
    }
  );

  it.each(['moved', 'removed'])(
    'retains the open position through a boundary after its row is %s',
    async (change) => {
      await createRoot(async (dispose) => {
        const [a, b, c, later] = ['a', 'b', 'c', 'later'].map((id) => ({
          key: id,
          entity: { id },
        }));
        const load = vi.fn(async () => {
          setRows(change === 'moved' ? [b, a, c, later] : [a, c, later]);
        });
        const [rows, setRows] = createSignal<Row[]>([
          a,
          b,
          { key: 'boundary', load },
          later,
        ]);
        const open = vi.fn();
        const navigation = useListDetailNavigation({
          currentId: () => 'b',
          getKey: (row) => row.key,
          source: {
            items: rows,
            hasMore: () => false,
            loadMore: async () => {},
            error: () => undefined,
          },
          getEntity: (row) => row.entity,
          getContinuation: (row) => row.load,
          open,
        });
        setRows(
          change === 'moved'
            ? [b, a, { key: 'boundary', load }, later]
            : [a, { key: 'boundary', load }, later]
        );
        await navigation.navigate(1);
        expect(load).toHaveBeenCalledOnce();
        expect(open).toHaveBeenCalledWith(c.entity);
        dispose();
      });
    }
  );

  it('keeps a removed occurrence anchored instead of jumping to a duplicate in another group', async () => {
    await createRoot(async (dispose) => {
      const [rows, setRows] = createSignal<Row[]>([
        { key: 'a:same', entity: { id: 'same' } },
        { key: 'a:next', entity: { id: 'wrong' } },
        { key: 'b:same', entity: { id: 'same' } },
        { key: 'b:next', entity: { id: 'right' } },
      ]);
      const open = vi.fn();
      const navigation = useListDetailNavigation({
        currentId: () => 'same',
        currentKey: () => 'b:same',
        getKey: (row) => row.key,
        source: {
          items: rows,
          hasMore: () => false,
          loadMore: async () => {},
          error: () => undefined,
        },
        getEntity: (row) => row.entity,
        open,
      });
      setRows((rows) => rows.filter((row) => row.key !== 'b:same'));
      await navigation.navigate(1);
      expect(open).toHaveBeenCalledWith({ id: 'right' });
      dispose();
    });
  });

  it('opens the final continuation after the first and only loaded row disappears', async () => {
    await createRoot(async (dispose) => {
      const next = { key: 'b', entity: { id: 'b' } };
      const load = vi.fn(async () => {
        setRows([next]);
      });
      const boundary = { key: 'boundary', load };
      const [rows, setRows] = createSignal<Row[]>([
        { key: 'a', entity: { id: 'a' } },
        boundary,
      ]);
      const open = vi.fn();
      const navigation = useListDetailNavigation({
        currentId: () => 'a',
        getKey: (row) => row.key,
        source: {
          items: rows,
          hasMore: () => false,
          loadMore: async () => {},
          error: () => undefined,
        },
        getEntity: (row) => row.entity,
        getContinuation: (row) => row.load,
        open,
      });
      setRows([boundary]);
      await navigation.navigate(1);
      expect(load).toHaveBeenCalledOnce();
      expect(open).toHaveBeenCalledWith(next.entity);
      dispose();
    });
  });

  it('pauses detail navigation while retained rows belong to a loading query', async () => {
    await createRoot(async (dispose) => {
      const [ready, setReady] = createSignal(false);
      const load = vi.fn(async () => {
        setReady(false);
      });
      const navigation = useListDetailNavigation({
        currentId: () => 'a',
        ready,
        source: {
          items: () => [
            { key: 'a', entity: { id: 'a' } },
            { key: 'boundary', load },
          ],
          hasMore: () => false,
          loadMore: async () => {},
          error: () => undefined,
        },
        getEntity: (row) => row.entity,
        getContinuation: (row) => row.load,
        open: vi.fn(),
      });
      expect(navigation.canNext()).toBe(false);
      await navigation.navigate(1);
      expect(load).not.toHaveBeenCalled();
      setReady(true);
      expect(navigation.canNext()).toBe(true);
      await navigation.navigate(1);
      expect(load).toHaveBeenCalledOnce();
      expect(navigation.canNext()).toBe(false);
      dispose();
    });
  });

  it('captures replacement query positions only after its rows are ready', async () => {
    await createRoot(async (dispose) => {
      const [a, b, c] = ['a', 'b', 'c'].map((id) => ({
        key: id,
        entity: { id },
      }));
      const [rows, setRows] = createSignal<Row[]>([a, b, c]);
      const [ready, setReady] = createSignal(true);
      const [identity, setIdentity] = createSignal('old');
      const open = vi.fn();
      const navigation = useListDetailNavigation({
        currentId: () => 'b',
        ready,
        identity,
        getKey: (row) => row.key,
        source: {
          items: rows,
          hasMore: () => false,
          loadMore: async () => {},
          error: () => undefined,
        },
        getEntity: (row) => row.entity,
        open,
      });
      setReady(false);
      setIdentity('new');
      setRows([b, a, c]);
      setReady(true);
      await navigation.navigate(1);
      expect(open).toHaveBeenCalledWith(a.entity);
      dispose();
    });
  });

  it('loads an internal boundary before a retained later group and coalesces repeated next', async () => {
    await createRoot(async (dispose) => {
      let finish!: () => void;
      const load = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          })
      );
      const a = { key: 'a:1', entity: { id: 'first' } };
      const next = { key: 'a:2', entity: { id: 'next' } };
      const b = { key: 'b:1', entity: { id: 'later' } };
      const [rows, setRows] = createSignal<Row[]>([
        a,
        { key: 'boundary', load },
        b,
      ]);
      const open = vi.fn();
      const navigation = useListDetailNavigation({
        currentId: () => 'first',
        source: {
          items: rows,
          hasMore: () => false,
          loadMore: async () => {},
          error: () => undefined,
        },
        getEntity: (row) => row.entity,
        getContinuation: (row) => row.load,
        open,
      });
      const pending = navigation.navigate(1);
      await navigation.navigate(1);
      expect(load).toHaveBeenCalledTimes(1);
      expect(open).not.toHaveBeenCalled();
      setRows([a, next, b]);
      finish();
      await pending;
      expect(open).toHaveBeenCalledWith(next.entity);
      dispose();
    });
  });
  it('cancels when the view changes during loading and reports failures without crossing', async () => {
    await createRoot(async (dispose) => {
      let finish!: () => void;
      const [identity, setIdentity] = createSignal('one');
      const onError = vi.fn();
      const open = vi.fn();
      const rows: Row[] = [
        { key: 'a', entity: { id: 'a' } },
        {
          key: 'boundary',
          load: () =>
            new Promise<void>((resolve) => {
              finish = resolve;
            }),
        },
        { key: 'b', entity: { id: 'b' } },
      ];
      const navigation = useListDetailNavigation({
        currentId: () => 'a',
        identity,
        source: {
          items: () => rows,
          hasMore: () => false,
          loadMore: async () => {},
          error: () => undefined,
        },
        getEntity: (row) => row.entity,
        getContinuation: (row) => row.load,
        open,
        onError,
      });
      const pending = navigation.navigate(1);
      setIdentity('two');
      finish();
      await pending;
      expect(open).not.toHaveBeenCalled();
      rows[1].load = async () => {
        throw new Error('offline');
      };
      await navigation.navigate(1);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(open).not.toHaveBeenCalled();
      dispose();
    });
  });
  it('cancels a pending boundary move when focus changes to another occurrence', async () => {
    await createRoot(async (dispose) => {
      let finish!: () => void;
      const [key, setKey] = createSignal('a:x');
      const rows: Row[] = [
        { key: 'a:x', entity: { id: 'same' } },
        {
          key: 'boundary',
          load: () =>
            new Promise<void>((resolve) => {
              finish = resolve;
            }),
        },
        { key: 'b:x', entity: { id: 'same' } },
        { key: 'b:y', entity: { id: 'next' } },
      ];
      const open = vi.fn();
      const resolved = vi.fn();
      const navigation = useListDetailNavigation({
        currentId: () => 'same',
        currentKey: key,
        getKey: (row) => row.key,
        onResolved: resolved,
        source: {
          items: () => rows,
          hasMore: () => false,
          loadMore: async () => {},
          error: () => undefined,
        },
        getEntity: (row) => row.entity,
        getContinuation: (row) => row.load,
        open,
      });
      const pending = navigation.navigate(1);
      setKey('b:x');
      finish();
      await pending;
      expect(open).not.toHaveBeenCalled();
      expect(resolved).not.toHaveBeenCalled();
      dispose();
    });
  });

  it('starts from the focused occurrence of a multi-group entity', async () => {
    await createRoot(async (dispose) => {
      const rows: Row[] = [
        { key: 'a:x', entity: { id: 'same' } },
        { key: 'a:y', entity: { id: 'wrong' } },
        { key: 'b:x', entity: { id: 'same' } },
        { key: 'b:y', entity: { id: 'right' } },
      ];
      const open = vi.fn();
      const resolved = vi.fn();
      const navigation = useListDetailNavigation({
        currentId: () => 'same',
        currentKey: () => 'b:x',
        getKey: (row) => row.key,
        onResolved: resolved,
        source: {
          items: () => rows,
          hasMore: () => false,
          loadMore: async () => {},
          error: () => undefined,
        },
        getEntity: (row) => row.entity,
        open,
      });
      await navigation.navigate(1);
      expect(open).toHaveBeenCalledWith(rows[3].entity);
      expect(resolved).toHaveBeenCalledWith(rows[3]);
      dispose();
    });
  });
});
