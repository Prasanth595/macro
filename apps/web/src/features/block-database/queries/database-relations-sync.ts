import { refreshInBackground } from '@queries/database-sql/create-database-sql-query';
import { useDatabaseTableChangedSync } from '@queries/storage/databases-sync';
import type { DatabaseRelationSource } from '../../database/context/relation-source';
import { useDatabaseSubscription } from './database-subscription';

/**
 * Related tables can live outside the open database; retain their gateway
 * subscription too, and catch up on what it missed while nobody tracked it.
 */
export function useRelatedDatabaseSync(
  databaseId: string,
  refreshRows: () => void
) {
  useDatabaseTableChangedSync(() => databaseId);
  useDatabaseSubscription(databaseId, refreshRows);
}

/** Retain a related database's subscription while its row labels are visible. */
export function RelatedDatabaseSync(props: {
  databaseId: string;
  targets: { databaseId: string; tableId: string }[];
  relations: (tableId: string) => DatabaseRelationSource;
}) {
  useRelatedDatabaseSync(props.databaseId, () => {
    for (const target of props.targets)
      if (target.databaseId === props.databaseId)
        refreshInBackground(props.relations(target.tableId));
  });
  return null;
}
