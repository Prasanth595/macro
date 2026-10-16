import { useCrmContactDiscovery } from '@app/features/crm/record-adapter';
import { debouncedDependent } from '@core/util/debounce';
import { useDatabaseDiscoverySync } from '@queries/storage/databases';
import type { Accessor } from 'solid-js';
import { useCommandItems } from './useCommandItems';

/** Command K's search pipeline, with instance-owned state for an embedded host. */
export function createCommandSearch(
  query: Accessor<string>,
  active: Accessor<boolean>
) {
  const text = () => (active() ? query().trim() : '');
  const debounced = debouncedDependent(text, 60);
  useDatabaseDiscoverySync(active);
  const source = useCommandItems(debounced, () => 'all', {
    searchActive: active,
    includeCommands: false,
    commandScopeCommands: () => [],
    entityActionMode: () => false,
    contactDiscovery: useCrmContactDiscovery,
  });
  return {
    items: () => (active() && debounced() === text() ? source.items() : []),
    isLoadingEntities: () =>
      active() && (debounced() !== text() || source.isLoadingEntities()),
    pagination: source.pagination,
  };
}
