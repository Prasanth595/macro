import { SYSTEM_PROPERTY_IDS } from '@property/identifiers';
import { queryClient } from '@queries/client';
import { partialMatchKey, type Query } from '@tanstack/solid-query';
import { refreshActiveGraphqlSoupQueries } from './graphql/active-queries';
import { soupKeys } from './keys';

/** Date edits can admit excluded entities and change unloaded bucket counts. */
export async function refreshDatePropertyQueries(
  propertyDefinitionId?: string
): Promise<void> {
  const prefixes = [
    soupKeys.astItems._def,
    soupKeys.groupedGroup._def,
    soupKeys.search._def,
  ];
  const dependsOnProperty = (input: unknown) => {
    const key = JSON.stringify(input);
    if (!key) return false;
    if (propertyDefinitionId) {
      return (
        key.includes(propertyDefinitionId) ||
        (propertyDefinitionId === SYSTEM_PROPERTY_IDS.DUE_DATE &&
          key.includes('due_date_'))
      );
    }
    // Assignment deletion does not identify its definition. Refresh date queries only.
    return [
      'due_date_',
      'date_ranges',
      '"dr":',
      '"dp"',
      '"date_range":',
      '"has_date":',
    ].some((marker) => key.includes(marker));
  };
  const predicate = (query: Query) =>
    prefixes.some((prefix) => partialMatchKey(query.queryKey, prefix)) &&
    dependsOnProperty(query.queryKey);
  await Promise.all([
    queryClient.invalidateQueries({ predicate }),
    refreshActiveGraphqlSoupQueries({ where: dependsOnProperty }),
  ]);
}
