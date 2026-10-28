import type {
  LinkedRows,
  PropertyValue,
} from '../../../generated/storage/types.gen';
import type { MacroClient } from '../../utils/client';
import { DatabaseColumn } from '../databases/column';
import { Database } from '../databases/database';
import { DatabaseRow } from '../databases/row';
import { DatabaseTable } from '../databases/table';

/** A readable source row linked to a CRM record, with its current preview. */
export interface LinkedDatabaseRow {
  /** The original row, with the database's own permissions. */
  row: DatabaseRow;
  /** Current source database name. */
  databaseName: string;
  /** Current source table name. */
  tableName: string;
  /** Fields in source order; absent values are empty cells. */
  fields: { column: DatabaseColumn; value: PropertyValue | undefined }[];
}

/** Turn authorized previews into source handles without expanding their grants. */
export function linkedDatabaseRows(
  client: MacroClient,
  response: LinkedRows,
): LinkedDatabaseRow[] {
  return response.tables.flatMap((group) => {
    const table = DatabaseTable.byId(
      Database.byId(client, group.table.table.database_id),
      group.table.table.id,
    );
    return group.rows.map((row) => ({
      row: DatabaseRow.byId(table, row.rowId),
      databaseName: group.databaseName,
      tableName: group.table.table.name,
      fields: group.table.columns.map((column) => ({
        column: DatabaseColumn.byId(table, column.column.id),
        value: row.cells[column.column.id],
      })),
    }));
  });
}
