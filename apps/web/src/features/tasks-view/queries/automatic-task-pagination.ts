import { fireAndForget } from '@core/util/fireAndForget';
import {
  type Accessor,
  createEffect,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js';

export type TaskPageSource = {
  id: string;
  hasMore: boolean;
  pending: boolean;
  load(): Promise<void>;
  error(): unknown;
};

/** Drains independent cursor chains, one request per chain at a time. */
export function createAutomaticTaskPagination(options: {
  enabled: Accessor<boolean>;
  scope: Accessor<string>;
  sources: Accessor<TaskPageSource[]>;
}) {
  const [error, setError] = createSignal<unknown>();
  const [revision, setRevision] = createSignal(0);
  const running = new Map<string, object>();
  const failed = new Set<string>();
  let scope: string | undefined;
  let generation = 0;
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });

  const load = async (
    source: TaskPageSource,
    token: object,
    version: number
  ) => {
    try {
      await source.load();
      if (disposed || version !== generation) return;
      const failure = source.error();
      if (failure) {
        failed.add(source.id);
        setError(() => failure);
      }
    } catch (failure) {
      if (!disposed && version === generation) {
        failed.add(source.id);
        setError(() => failure);
      }
    } finally {
      if (!disposed && running.get(source.id) === token) {
        running.delete(source.id);
        setRevision((value) => value + 1);
      }
    }
  };

  // This effect drives network reads as cursors settle; it does not derive UI state.
  createEffect(() => {
    revision();
    const nextScope = options.scope();
    if (nextScope !== scope) {
      scope = nextScope;
      generation += 1;
      running.clear();
      failed.clear();
      setError(undefined);
    }
    if (!options.enabled() || error()) return;
    for (const source of options.sources()) {
      // A failed cursor can temporarily make a query report no next page.
      if (
        (!source.hasMore && !failed.has(source.id)) ||
        source.pending ||
        running.has(source.id)
      )
        continue;
      failed.delete(source.id);
      const token = {};
      running.set(source.id, token);
      untrack(() =>
        fireAndForget(load(source, token, generation), 'tasks-view')
      );
    }
  });

  return { error, retry: () => setError(undefined) };
}
