/** The occurrence and its original neighbours, nearest first. */
export type ListNavigationPosition<TKey = string> = {
  key: TKey;
  previous: TKey[];
  next: TKey[];
};

export function listNavigationPosition<TKey>(
  keys: readonly TKey[],
  key: TKey
): ListNavigationPosition<TKey> | undefined {
  const index = keys.indexOf(key);
  if (index < 0) return;
  return {
    key,
    previous: keys.slice(0, index).reverse(),
    next: keys.slice(index + 1),
  };
}

/** Step from the original position after a row moves or disappears. */
export function listNavigationStartIndex<TKey>(
  keys: readonly TKey[],
  key: TKey,
  direction: -1 | 1,
  position?: ListNavigationPosition<TKey>
): number | undefined {
  const indexes = new Map(keys.map((key, index) => [key, index]));
  const current = indexes.get(key);
  if (!position || position.key !== key)
    return current === undefined ? undefined : current + direction;
  const survivor = (neighbors: TKey[]) =>
    neighbors
      .map((neighbor) => indexes.get(neighbor))
      .find((index) => index !== undefined);
  const before = survivor(position.previous);
  const after = survivor(position.next);
  // A row still between its original neighbours keeps its current position.
  // In particular, never skip an unfinished boundary immediately after it.
  if (
    current !== undefined &&
    (before === undefined || before < current) &&
    (after === undefined || current < after)
  )
    return current + direction;
  if (before !== undefined) return direction === 1 ? before + 1 : before;
  if (after !== undefined) {
    // The first row disappeared: include rows inserted ahead of its successor
    // by a continuation fetched during this navigation.
    if (position.previous.length === 0) return direction === 1 ? 0 : -1;
    return direction === 1 ? after : after - 1;
  }
  return current === undefined ? undefined : current + direction;
}

/** Resume where a fetched boundary used to be, even when its final page removes it. */
export function listNavigationResumeIndex<TKey>(
  keys: readonly TKey[],
  previous: readonly TKey[]
): number {
  const indexes = new Map(keys.map((key, index) => [key, index]));
  const before = previous
    .map((key) => indexes.get(key))
    .find((index) => index !== undefined);
  return before === undefined ? 0 : before + 1;
}
