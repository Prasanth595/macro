import { fireAndForget } from '@core/util/fireAndForget';
import { type Accessor, createMemo, createSignal, onCleanup } from 'solid-js';
import type { ListDataSource } from './list-data-source';
import {
  listNavigationPosition,
  listNavigationResumeIndex,
  listNavigationStartIndex,
} from './list-navigation-position';

export type ListDetailNavigationTarget = {
  canPrevious: Accessor<boolean>;
  canNext: Accessor<boolean>;
  previous: () => void;
  next: () => void;
};

export type ListDetailNavigationOptions<TEntity> = {
  fallbackDirection?: -1 | 1;
  beforeOpen?: (
    next: TEntity | undefined,
    current: TEntity | undefined
  ) => boolean | void;
};

export type ListDetailNavigation<TEntity> = ListDetailNavigationTarget & {
  navigate: (
    direction: -1 | 1,
    options?: ListDetailNavigationOptions<TEntity>
  ) => Promise<void>;
  open: (entity: TEntity) => void;
};

type NavigationStep<TEntity, TItem> =
  | { kind: 'entity'; entity: TEntity; item: TItem }
  | { kind: 'continuation'; load: () => Promise<unknown>; previous: TItem[] };

export function useListDetailNavigation<
  TItem,
  TEntity extends { id: string },
>(options: {
  currentId: Accessor<string>;
  currentKey?: Accessor<string | undefined>;
  getKey?: (item: TItem) => string;
  identity?: Accessor<string>;
  ready?: Accessor<boolean>;
  source: Pick<
    ListDataSource<TItem>,
    'items' | 'hasMore' | 'loadMore' | 'error'
  >;
  getEntity: (item: TItem) => TEntity | undefined;
  onResolved?: (item: TItem) => void;
  getContinuation?: (item: TItem) => (() => Promise<unknown>) | undefined;
  open: (entity: TEntity) => void;
  onError?: (error: unknown) => void;
}): ListDetailNavigation<TEntity> {
  const [navigating, setNavigating] = createSignal(false);
  let disposed = false;

  onCleanup(() => {
    disposed = true;
  });

  const isCurrent = (id: string) => !disposed && options.currentId() === id;
  const currentEntity = () =>
    options.source
      .items()
      .map(options.getEntity)
      .find((entity) => entity?.id === options.currentId());

  const itemKey = (item: TItem) =>
    options.getKey?.(item) ?? options.getEntity(item)?.id ?? item;
  const anchor = createMemo<{
    id: string;
    key: string | TItem;
    identity: string | undefined;
    position: ReturnType<typeof listNavigationPosition<string | TItem>>;
  }>((previous) => {
    const ready = options.ready?.() !== false;
    const id = options.currentId();
    const identity = options.identity?.();
    const items = options.source.items();
    const focusedOccurrence = items.find(
      (item) =>
        itemKey(item) === options.currentKey?.() &&
        options.getEntity(item)?.id === id
    );
    const firstOccurrence = items.find(
      (item) => options.getEntity(item)?.id === id
    );
    const key =
      focusedOccurrence !== undefined
        ? itemKey(focusedOccurrence)
        : previous?.id === id &&
            previous.identity === identity &&
            previous.position
          ? previous.key
          : firstOccurrence !== undefined
            ? itemKey(firstOccurrence)
            : id;
    if (
      previous?.id === id &&
      previous.key === key &&
      previous.identity === identity &&
      previous.position
    )
      return previous;
    return {
      id,
      key,
      identity,
      position: ready
        ? listNavigationPosition(items.map(itemKey), key)
        : undefined,
    };
  });

  const currentKey = () => anchor().key;

  const target = (
    direction: -1 | 1,
    resumeAfter?: readonly TItem[]
  ): NavigationStep<TEntity, TItem> | undefined => {
    if (options.ready?.() === false) return;
    const items = options.source.items();
    const start =
      listNavigationStartIndex(
        items.map(itemKey),
        currentKey(),
        direction,
        anchor().position
      ) ??
      (resumeAfter
        ? listNavigationResumeIndex(
            items.map(itemKey),
            resumeAfter.map(itemKey)
          )
        : undefined);
    if (start === undefined) return;

    for (
      let index = start;
      index >= 0 && index < items.length;
      index += direction
    ) {
      const item = items[index];
      if (!item) continue;

      const entity = options.getEntity(item);
      // Skip only this occurrence; another group may contain the same entity.
      if (itemKey(item) === currentKey()) continue;
      if (entity) return { kind: 'entity', entity, item };

      const load =
        direction === 1 ? options.getContinuation?.(item) : undefined;
      if (load)
        return {
          kind: 'continuation',
          load,
          previous: items.slice(0, index).reverse(),
        };
    }

    if (direction === 1 && options.source.hasMore()) {
      return {
        kind: 'continuation',
        load: options.source.loadMore,
        previous: [...items].reverse(),
      };
    }
  };

  const resolve = async (
    direction: -1 | 1,
    requestIsCurrent: () => boolean
  ): Promise<{ entity: TEntity; item: TItem } | undefined> => {
    let resumeAfter: TItem[] | undefined;
    while (requestIsCurrent()) {
      const step = target(direction, resumeAfter);
      if (!step) return;
      if (step.kind === 'entity') return step;

      resumeAfter = step.previous;
      await step.load();
      if (!requestIsCurrent()) return;

      const error = options.source.error();
      if (error) throw error;
    }
  };

  const open = (entity: TEntity) => {
    if (!disposed) options.open(entity);
  };

  const navigate = async (
    direction: -1 | 1,
    navigationOptions: ListDetailNavigationOptions<TEntity> = {}
  ) => {
    if (disposed || navigating()) return;
    setNavigating(true);
    const currentId = options.currentId();
    const current = currentEntity();
    const identity = options.identity?.();
    const currentKey = options.currentKey?.();
    const requestIsCurrent = () =>
      isCurrent(currentId) &&
      options.ready?.() !== false &&
      identity === options.identity?.() &&
      currentKey === options.currentKey?.();

    try {
      let next = await resolve(direction, requestIsCurrent);
      if (
        !next &&
        navigationOptions.fallbackDirection !== undefined &&
        requestIsCurrent()
      ) {
        next = await resolve(
          navigationOptions.fallbackDirection,
          requestIsCurrent
        );
      }
      if (!requestIsCurrent()) return;
      if (navigationOptions.beforeOpen?.(next?.entity, current) === false)
        return;
      if (next) {
        options.onResolved?.(next.item);
        open(next.entity);
      }
    } catch (error) {
      if (requestIsCurrent()) options.onError?.(error);
    } finally {
      setNavigating(false);
    }
  };

  return {
    canPrevious: () => !navigating() && target(-1)?.kind === 'entity',
    canNext: () => !navigating() && target(1) !== undefined,
    previous: () => {
      fireAndForget(navigate(-1), 'list-detail-navigation');
    },
    next: () => {
      fireAndForget(navigate(1), 'list-detail-navigation');
    },
    navigate,
    open,
  };
}
