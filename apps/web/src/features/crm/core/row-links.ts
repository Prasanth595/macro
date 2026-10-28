import type { DatabaseViewColumn } from '../../database/core/database-view';
import type { DatabaseRow } from '../../database/core/table';

export type RowLinkTarget =
  | { type: 'company'; companyId: string }
  | { type: 'entry'; pipelineId: string; rowId: string };

export type RowReference = {
  databaseId: string;
  tableId: string;
  rowId: string;
};

export type LinkedRowGroup = {
  databaseId: string;
  databaseName: string;
  tableId: string;
  tableName: string;
  columns: DatabaseViewColumn[];
  rows: DatabaseRow[];
};
