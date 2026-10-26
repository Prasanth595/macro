import { useFeatureFlag } from '@app/lib/analytics/posthog';
import { openDocument } from '@core/component/LexicalMarkdown/component/core/BlockLink';
import { StaticMarkdownContext } from '@core/component/LexicalMarkdown/component/core/StaticMarkdown';
import { enableDatabases } from '@core/constant/featureFlags';
import { queryReadyGate } from '@queries/gate';
import { useDatabasesQuery } from '@queries/storage/databases';
import { useDatabaseTableChanges } from '@queries/storage/databases-sync';
import { storageServiceClient } from '@service-storage/client';
import { createCallback } from '@solid-primitives/rootless';
import { useQueryClient } from '@tanstack/solid-query';
import { createMemo, createSignal, For, Show } from 'solid-js';
import {
  DatabaseMentionValue,
  DatabaseTextValue,
} from '../block-database/database-mentions';
import { createDatabaseRelations } from '../block-database/queries/database-relations';
import { RelatedDatabaseSync } from '../block-database/queries/database-relations-sync';
import {
  LinkedRowPicker,
  LinkedRowPreview,
  LinkedRowsSection,
  type RowPickerProps,
  type RowPickerTable,
} from './components/linked-rows';
import type { LinkedRowsView } from './context/row-links';
import type { RowReference } from './core/row-links';
import { createRowLinks } from './queries/row-links';

/** App dependencies stop here; the shared record panel receives only its slot. */
export const CrmLinkedRows: LinkedRowsView = (props) => {
  const databases = useFeatureFlag(enableDatabases);
  const openRow = createCallback((row: RowReference) => {
    openDocument('database', row.databaseId, {
      tableId: row.tableId,
      rowId: row.rowId,
    });
  });
  const deps = { storage: storageServiceClient, client: useQueryClient() };
  const identity = () =>
    props.target.type === 'company'
      ? props.target.companyId
      : `${props.target.pipelineId}:${props.target.rowId}`;
  return (
    <Show when={databases().enabled && identity()} keyed>
      {(_identity) => {
        const source = createRowLinks(deps, () => props.target);
        const targets = createMemo(() => {
          const state = source.state();
          return state.kind === 'ready'
            ? state.groups.flatMap((group) =>
                group.columns
                  .slice(0, 4)
                  .flatMap((column) =>
                    column.relation ? [column.relation] : []
                  )
              )
            : [];
        });
        const relatedDatabases = createMemo(() => [
          ...new Set(targets().map((target) => target.databaseId)),
        ]);
        const relations = createDatabaseRelations({
          targets,
          onTableChanged: (listener) =>
            useDatabaseTableChanges((change) => listener(change.tableId)),
        });
        return (
          <StaticMarkdownContext>
            <For each={relatedDatabases()}>
              {(id) => (
                <RelatedDatabaseSync
                  databaseId={id}
                  targets={targets()}
                  relations={relations}
                />
              )}
            </For>
            <LinkedRowsSection
              source={source}
              canEdit={props.canEdit}
              Picker={RowPicker}
              openRow={openRow}
              renderPreview={(group, row) => (
                <LinkedRowPreview
                  row={row}
                  columns={group.columns.slice(0, 4).map((column) => {
                    const relation = column.relation;
                    if (!relation) return column;
                    const related = relations(relation.tableId);
                    return {
                      ...column,
                      relation: {
                        ...relation,
                        labels: Object.fromEntries(
                          (related.error() ? [] : related.rows()).map((row) => [
                            row.id,
                            row.name,
                          ])
                        ),
                      },
                    };
                  })}
                  renderTextValue={(value) => (
                    <DatabaseTextValue value={value} />
                  )}
                  renderMentionValue={(id, entityType) => (
                    <DatabaseMentionValue id={id} entityType={entityType} />
                  )}
                />
              )}
            />
          </StaticMarkdownContext>
        );
      }}
    </Show>
  );
};

function RowPicker(props: RowPickerProps) {
  const databases = useDatabasesQuery();
  const [selected, setSelected] = createSignal<RowPickerTable>();
  const targets = createMemo(() => {
    const table = selected();
    return table
      ? [{ databaseId: table.databaseId, tableId: table.tableId }]
      : [];
  });
  const relations = createDatabaseRelations({
    targets,
    onTableChanged: (listener) =>
      useDatabaseTableChanges((change) => listener(change.tableId)),
  });
  const rows = createMemo(() => {
    const table = selected();
    return table ? relations(table.tableId) : undefined;
  });
  return (
    <LinkedRowPicker
      {...props}
      tables={
        queryReadyGate(databases)
          ? databases.data
              .filter((entry) => !entry.database.trashed_at)
              .flatMap((entry) =>
                entry.tables.map((table) => ({
                  databaseId: entry.database.id,
                  tableId: table.id,
                  name: `${entry.database.name} / ${table.name}`,
                }))
              )
          : []
      }
      selected={selected()}
      onSelectTable={setSelected}
      rows={rows()?.rows() ?? []}
      loading={databases.isPending || (rows()?.loading() ?? false)}
      error={databases.isError ? 'Could not load databases.' : rows()?.error()}
      retry={async () => {
        const source = rows();
        if (source) await source.refresh();
        else await databases.refetch();
      }}
    />
  );
}
