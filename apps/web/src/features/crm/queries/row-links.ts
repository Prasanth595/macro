import { Telemetry } from '@macro-inc/observability';
import type { LinkedRows } from '@service-storage/generated/schemas/linkedRows';
import { useQuery } from '@tanstack/solid-query';
import type { Accessor } from 'solid-js';
import { toViewColumn } from '../../database/queries/column-detail';
import { databasePropertyCell } from '../../database/queries/property-cell';
import type { RowLinksSource } from '../context/row-links';
import type { LinkedRowGroup, RowLinkTarget } from '../core/row-links';
import type { CrmRecordDependencies } from './dependencies';
import { crmKeys } from './keys';

export function linkedRowGroups(data: LinkedRows): LinkedRowGroup[] {
  return data.tables.map((group) => ({
    databaseId: group.table.table.database_id,
    databaseName: group.databaseName,
    tableId: group.table.table.id,
    tableName: group.table.table.name,
    columns: group.table.columns.map(toViewColumn),
    rows: group.rows.map((row) => ({
      rowId: row.rowId,
      cells: Object.fromEntries(
        group.table.columns.map((column) => [
          column.column.id,
          databasePropertyCell(row.cells[column.column.id], column),
        ])
      ),
    })),
  }));
}

export type RowLinkDependencies = Pick<CrmRecordDependencies, 'client'> & {
  storage: Pick<
    CrmRecordDependencies['storage'],
    'getCrmLinkedRows' | 'linkCrmRow' | 'unlinkCrmRow'
  >;
};

function linkedRowsOptions(
  storage: RowLinkDependencies['storage'],
  target: RowLinkTarget
) {
  return {
    queryKey: crmKeys.linkedRows(target).queryKey,
    queryFn: () =>
      Telemetry.span('crm.row_link.read', async (span) => {
        span.setAttr('crm.target.type', target.type);
        span.setAttr(
          'crm.target.id',
          target.type === 'company' ? target.companyId : target.pipelineId
        );
        if (target.type === 'entry') span.setAttr('crm.entry.id', target.rowId);
        try {
          const result = await storage.getCrmLinkedRows(target);
          if (result.isErr()) throw result.error;
          return linkedRowGroups(result.value);
        } catch (error) {
          span.error('Linked rows read failed');
          throw error;
        }
      }),
    refetchInterval: 10000,
    staleTime: 0,
    throwOnError: false,
  };
}

/** Query identity includes the target, so changing records never reuses another's links. */
export function createRowLinks(
  deps: RowLinkDependencies,
  target: Accessor<RowLinkTarget>
): RowLinksSource {
  const query = useQuery(
    () => linkedRowsOptions(deps.storage, { ...target() }),
    () => deps.client
  );
  async function refresh() {
    await query.refetch();
  }
  return {
    // Source access is independent of CRM access. Hide cached previews when a
    // refresh fails rather than treating their previous authorization as current.
    state: () =>
      query.isError
        ? { kind: 'error' }
        : query.isSuccess
          ? { kind: 'ready', groups: query.data }
          : { kind: 'loading' },
    refresh,
    link: (source) =>
      Telemetry.span('crm.row_link.add', async (span) => {
        const current = target();
        span.setAttr('crm.target.type', current.type);
        span.setAttr(
          'crm.target.id',
          current.type === 'company' ? current.companyId : current.pipelineId
        );
        if (current.type === 'entry')
          span.setAttr('crm.entry.id', current.rowId);
        span.setAttr('source.row.id', source.rowId);
        try {
          const result = await deps.storage.linkCrmRow(current, source);
          if (result.isErr()) throw result.error;
        } catch (error) {
          span.error('Link failed');
          throw error;
        }
        // A committed link remains committed even if re-reading its preview fails.
        await deps.client.invalidateQueries({
          queryKey: crmKeys.linkedRows(current).queryKey,
        });
      }),
    unlink: (rowId) =>
      Telemetry.span('crm.row_link.remove', async (span) => {
        const current = target();
        span.setAttr('crm.target.type', current.type);
        span.setAttr(
          'crm.target.id',
          current.type === 'company' ? current.companyId : current.pipelineId
        );
        if (current.type === 'entry')
          span.setAttr('crm.entry.id', current.rowId);
        span.setAttr('source.row.id', rowId);
        try {
          const result = await deps.storage.unlinkCrmRow(current, rowId);
          if (result.isErr()) throw result.error;
        } catch (error) {
          span.error('Unlink failed');
          throw error;
        }
        await deps.client.invalidateQueries({
          queryKey: crmKeys.linkedRows(current).queryKey,
        });
      }),
  };
}
