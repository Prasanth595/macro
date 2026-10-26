import { analytics } from '@app/lib/analytics';
import type { DatabaseOp } from '@core/database-sql/generated/types';
import { countRowWrites } from '@queries/storage/databases';
import { err, errAsync, ok, ResultAsync } from 'neverthrow';
import type { DatabaseApi } from '../../database/core/api';
import { toViewColumn } from '../../database/queries/column-detail';
import { databasePropertyCell } from '../../database/queries/property-cell';
import type { Pipeline } from '../core/pipeline';
import type { CrmRecordDependencies } from './dependencies';

/**
 * Reports a committed pipeline write's row counts: inserted rows are entries
 * added, updated rows include stage moves. Never cell contents.
 */
export function trackPipelineEntryWrites(
  pipeline: { id: string; recordType?: Pipeline['recordType'] },
  surface: 'pipeline' | 'record',
  ops: DatabaseOp[]
) {
  const counts = countRowWrites(ops);
  if (counts.insertedRows + counts.updatedRows + counts.deletedRows === 0)
    return;
  analytics.track('crm_pipeline_entries_edited', {
    pipelineId: pipeline.id,
    recordType: pipeline.recordType,
    surface,
    ...counts,
  });
}

/** Transport adapter only; the shared provider owns queries and editing. */
export function createPipelineApi(
  storage: Pick<
    CrmRecordDependencies['storage'],
    'getCrmPipelineTable' | 'queryCrmPipelineRows' | 'applyCrmPipelineOps'
  >,
  pipeline: Pipeline
): DatabaseApi {
  const failure = () => ({
    kind: 'fetch' as const,
    message: 'Could not read this pipeline.',
  });
  const table = () =>
    new ResultAsync(storage.getCrmPipelineTable(pipeline.id)).mapErr(failure);
  return {
    key: ['crm', 'pipeline', pipeline.id],
    readTable: (tableId) =>
      tableId !== pipeline.tableId
        ? errAsync(failure())
        : table().map((detail) => ({
            id: detail.table.id,
            databaseId: detail.table.database_id,
            name: pipeline.name,
            version: detail.table.version,
            columns: detail.columns.map((column) => ({
              ...toViewColumn(column),
              primary: column.column.id === pipeline.primaryColumnId,
            })),
          })),
    readRows: (request) =>
      request.tableId !== pipeline.tableId
        ? errAsync(failure())
        : table().andThen((schema) =>
            new ResultAsync(
              storage.queryCrmPipelineRows(pipeline.id, {
                after: request.cursor,
                query: {
                  ...request.query,
                  filter: request.query.filter ?? null,
                },
                rowIds: request.rowIds,
              })
            )
              .mapErr(failure)
              .andThen((page) => {
                if (page.version !== schema.table.version)
                  return err(failure());
                return ok({
                  tableVersion: page.version,
                  nextCursor: page.next ?? undefined,
                  rows: page.rows.map((row) => ({
                    rowId: row.rowId,
                    cells: Object.fromEntries(
                      schema.columns.map((column) => [
                        column.column.id,
                        databasePropertyCell(
                          row.cells[column.column.id],
                          column
                        ),
                      ])
                    ),
                  })),
                });
              })
          ),
    applyOps: (batch) =>
      storage
        .applyCrmPipelineOps(pipeline.id, batch)
        .mapErr(([error]) => error)
        .map((applied) => {
          trackPipelineEntryWrites(pipeline, 'pipeline', batch.ops);
          return applied;
        }),
  };
}
