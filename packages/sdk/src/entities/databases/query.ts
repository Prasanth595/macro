import { match } from 'ts-pattern';
import type {
  ResultColumn,
  ResultSet,
  SqlOutcome,
  SqlStatement,
  TableVersion,
} from '../../../generated/storage/types.gen';
import { unwrap } from '../../utils';
import type { MacroClient } from '../../utils/client';
import { DatabaseColumn } from './column';
import type { Database } from './database';
import { DatabaseRow } from './row';
import { DatabaseTable } from './table';

/** A version observed on a typed table handle, reusable as a write guard. */
export interface QueryTableVersion {
  table: DatabaseTable;
  version: TableVersion;
}

/** Scope and optimistic concurrency for one SQL statement. */
export interface DatabaseQueryOptions {
  /** Default database for unqualified table names; visible databases remain joinable. */
  database?: Database;
  /** Refuse writes if these tables changed since they were read. */
  baseVersions?: QueryTableVersion[];
}

/** Result column metadata, including a typed relation target when visible. */
export type QueryColumn = Omit<ResultColumn, 'relatedTable'> & {
  relatedTable?: DatabaseTable;
};

/** SQL returns dynamically shaped, discriminated cells and optional source row handles. */
export interface QueryResultSet {
  columns: QueryColumn[];
  rows: ResultSet['rows'];
  sourceTable?: DatabaseTable;
  rowHandles: DatabaseRow[];
}

/** What ran, with typed handles for resources written by the statement. */
export type QueryStatement =
  | Extract<SqlStatement, { kind: 'select' }>
  | { kind: 'schema'; database: Database; summary: string }
  | {
      kind: 'insert' | 'update' | 'delete';
      table: DatabaseTable;
      tableName: string;
    }
  | {
      kind: 'alterColumnType';
      table: DatabaseTable;
      tableName: string;
      column: DatabaseColumn;
      columnName: string;
      to: string;
    };

/** The committed outcome of one statement; write calls are never automatically retried. */
export interface DatabaseQueryResult {
  result?: QueryResultSet;
  changesApplied: number;
  insertedRows: DatabaseRow[];
  newVersions: QueryTableVersion[];
  readVersions: QueryTableVersion[];
  truncatedTables: string[];
  statement: QueryStatement;
}

/** @internal Execute through the generated client and hydrate resource references. */
export async function queryDatabases(
  client: MacroClient,
  databaseById: typeof Database.byId,
  sql: string,
  options: DatabaseQueryOptions = {},
): Promise<DatabaseQueryResult> {
  const response = unwrap(
    await client.storage.queryDatabases({
      body: {
        sql,
        databaseId: options.database?.id,
        baseVersions: Object.fromEntries(
          (options.baseVersions ?? []).map(({ table, version }) => [
            table.id,
            version,
          ]),
        ),
      },
    }),
  );
  const databases = new Map<string, Set<Database>>();
  for (const handle of [
    options.database,
    ...(options.baseVersions ?? []).map(({ table }) => table.database),
  ]) {
    if (!handle) continue;
    const handles = databases.get(handle.id);
    if (handles) handles.add(handle);
    else databases.set(handle.id, new Set([handle]));
  }
  const database = (id: string): Database => {
    const known = databases.get(id)?.values().next().value;
    if (known) return known;
    const handle = databaseById(client, id);
    databases.set(id, new Set([handle]));
    return handle;
  };
  const table = (id: string): DatabaseTable => {
    const databaseId = response.tableDatabases[id];
    if (!databaseId)
      throw new Error(`SQL response is missing the owner of table ${id}`);
    return DatabaseTable.byId(database(databaseId), id);
  };
  const writtenDatabases = new Set(
    Object.keys(response.newVersions).map((id) => response.tableDatabases[id]),
  );
  if (response.statement.kind === 'schema')
    writtenDatabases.add(response.statement.databaseId);
  for (const id of writtenDatabases)
    for (const handle of databases.get(id) ?? []) handle.invalidateSchema();
  const statement = match(response.statement)
    .with({ kind: 'select' }, (value): QueryStatement => value)
    .with(
      { kind: 'schema' },
      ({ databaseId, summary }): QueryStatement => ({
        kind: 'schema',
        database: database(databaseId),
        summary,
      }),
    )
    .with(
      { kind: 'insert' },
      { kind: 'update' },
      { kind: 'delete' },
      ({ kind, tableId, tableName }): QueryStatement => ({
        kind,
        table: table(tableId),
        tableName,
      }),
    )
    .with(
      { kind: 'alterColumnType' },
      ({ tableId, tableName, columnId, columnName, to }): QueryStatement => {
        const target = table(tableId);
        return {
          kind: 'alterColumnType',
          table: target,
          tableName,
          column: DatabaseColumn.byId(target, columnId),
          columnName,
          to,
        };
      },
    )
    .exhaustive();
  return {
    result: response.result
      ? resultSet(response.result, table, response.tableDatabases)
      : undefined,
    changesApplied: response.changesApplied,
    insertedRows:
      statement.kind === 'insert'
        ? response.insertedRowIds.map((id) =>
            DatabaseRow.byId(statement.table, id),
          )
        : [],
    newVersions: Object.entries(response.newVersions).map(([id, version]) => ({
      table: table(id),
      version,
    })),
    readVersions: Object.entries(response.readVersions).map(
      ([id, version]) => ({ table: table(id), version }),
    ),
    truncatedTables: response.truncatedTables,
    statement,
  };
}

function resultSet(
  result: ResultSet,
  table: (id: string) => DatabaseTable,
  owners: SqlOutcome['tableDatabases'],
): QueryResultSet {
  const sourceTable =
    result.sourceTable && owners[result.sourceTable]
      ? table(result.sourceTable)
      : undefined;
  return {
    columns: result.columns.map(({ relatedTable, ...column }) => ({
      ...column,
      relatedTable:
        relatedTable && owners[relatedTable] ? table(relatedTable) : undefined,
    })),
    rows: result.rows,
    sourceTable,
    rowHandles: sourceTable
      ? result.rowIds.map((id) => DatabaseRow.byId(sourceTable, id))
      : [],
  };
}
