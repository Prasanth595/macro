import {
  type ListNavigationPosition,
  listNavigationResumeIndex,
  listNavigationStartIndex,
} from '@app/components/list/list-navigation-position';
import type { SoupEntityRow, SoupRow } from '../create-soup-state';

/** Resolve a row occurrence without crossing an unfinished forward group boundary. */
export async function resolveGroupedNeighbor(options: {
  rows: () => readonly SoupRow[];
  currentKey: string | undefined;
  direction: -1 | 1;
  position?: ListNavigationPosition;
  isCurrent: () => boolean;
  load: (key: string) => Promise<void>;
  error: (key: string) => Error | null;
  accept?: (row: SoupEntityRow) => boolean;
}): Promise<SoupEntityRow | undefined> {
  let resumeAfter: string[] | undefined;
  while (options.isCurrent()) {
    const rows = options.rows();
    const keys = rows.map((row) => row.identityKey);
    const start =
      options.currentKey === undefined
        ? options.direction === 1
          ? 0
          : rows.length - 1
        : (listNavigationStartIndex(
            keys,
            options.currentKey,
            options.direction,
            options.position
          ) ??
          (resumeAfter
            ? listNavigationResumeIndex(keys, resumeAfter)
            : undefined));
    if (start === undefined) return;
    let boundary: SoupRow | undefined;
    for (
      let index = start;
      index >= 0 && index < rows.length;
      index += options.direction
    ) {
      const row = rows[index];
      if (row.identityKey === options.currentKey) continue;
      if (row.group && !row.group.isExpanded()) continue;
      if (row.kind === 'entity' && (options.accept?.(row) ?? true)) return row;
      if (options.direction === 1 && row.kind === 'group-status') {
        boundary = row;
        break;
      }
    }
    if (!boundary?.group) return;
    const group = boundary.group;
    const error = options.error(group.key);
    if (error) throw error;
    resumeAfter = keys.slice(0, rows.indexOf(boundary)).reverse();
    await options.load(group.key);
    if (!options.isCurrent() || !group.isExpanded()) return;
    const nextError = options.error(group.key);
    if (nextError) throw nextError;
  }
}
