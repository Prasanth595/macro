import type { PipedreamCatalogEntryResponse } from '@service-cognition/client';

/** Group each app once, using Pipedream's first category and preserving its ranking. */
export function groupCatalogByCategory(
  entries: PipedreamCatalogEntryResponse[]
) {
  const groups = new Map<string, PipedreamCatalogEntryResponse[]>();
  for (const entry of entries) {
    const name =
      entry.categories?.find((category) => category.trim())?.trim() ?? 'Other';
    const group = groups.get(name) ?? [];
    group.push(entry);
    groups.set(name, group);
  }
  return [...groups]
    .map(([name, entries]) => ({ name, entries }))
    .sort((a, b) => {
      if (a.name === 'Other') return 1;
      if (b.name === 'Other') return -1;
      return a.name.localeCompare(b.name);
    });
}
