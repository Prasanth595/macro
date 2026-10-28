import type { LinkedRows } from '@service-storage/generated/schemas/linkedRows';
import { render, waitFor } from '@solidjs/testing-library';
import { QueryClient } from '@tanstack/solid-query';
import { ok } from 'neverthrow';
import { expect, it, vi } from 'vitest';
import { LinkedRowsSection } from '../components/linked-rows';
import type { RowLinksSource } from '../context/row-links';
import type { CrmRecordDependencies } from '../queries/dependencies';
import { createRowLinks } from '../queries/row-links';

type LinkedRowsResult = Awaited<
  ReturnType<CrmRecordDependencies['storage']['getCrmLinkedRows']>
>;

it('keeps focus on refresh and row identity through reorders and revocation', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let data: LinkedRows = {
    tables: [
      {
        databaseName: 'Billing',
        table: {
          table: {
            database_id: 'billing',
            id: 'invoices',
            name: 'Invoices',
            position: 'a0',
            version: 1,
          },
          columns: [],
          views: [],
          sql_name: '"Billing"."Invoices"',
        },
        rows: [
          { rowId: 'first', cells: {} },
          { rowId: 'second', cells: {} },
        ],
      },
    ],
  };
  const storage = {
    getCrmLinkedRows: vi.fn(async (): Promise<LinkedRowsResult> => ok(data)),
    linkCrmRow: vi.fn(async () => ok(undefined)),
    unlinkCrmRow: vi.fn(async () => ok(undefined)),
  };
  let source: RowLinksSource | undefined;
  const openRow = vi.fn();
  const view = render(() => {
    source = createRowLinks({ client, storage }, () => ({
      type: 'company',
      companyId: 'company',
    }));
    return (
      <LinkedRowsSection
        source={source}
        canEdit
        Picker={() => null}
        Preview={(preview) => (
          <button type="button">{preview.row.rowId}</button>
        )}
        openRow={openRow}
      />
    );
  });
  try {
    await view.findByText('second');
    const focused = view.getAllByRole('button', { name: 'Open source row' })[1];
    focused.focus();
    expect(document.activeElement).toBe(focused);
    data = structuredClone(data);
    data.tables[0].databaseName = 'Renamed billing';
    data.tables[0].table.table.name = 'Paid invoices';
    await source?.refresh();
    await view.findByText('Renamed billing / Paid invoices');
    expect(view.getAllByRole('button', { name: 'Open source row' })[1]).toBe(
      focused
    );
    expect(document.activeElement).toBe(focused);
    const preview = view.getByRole('button', { name: 'second' });
    preview.focus();
    data = structuredClone(data);
    data.tables[0].databaseName = 'Current billing';
    await source?.refresh();
    await view.findByText('Current billing / Paid invoices');
    expect(view.getByRole('button', { name: 'second' })).toBe(preview);
    expect(document.activeElement).toBe(preview);
    data = structuredClone(data);
    data.tables[0].rows.reverse();
    await source?.refresh();
    expect(view.getAllByRole('button', { name: 'Open source row' })[0]).toBe(
      focused
    );
    focused.click();
    expect(openRow).toHaveBeenCalledWith({
      databaseId: 'billing',
      tableId: 'invoices',
      rowId: 'second',
    });
    data = structuredClone(data);
    data.tables[0].rows = [data.tables[0].rows[1]];
    await source?.refresh();
    await waitFor(() => expect(view.queryByText('second')).toBeNull());
    expect(focused.isConnected).toBe(false);
    expect(
      view.getAllByRole('button', { name: 'Open source row' })
    ).toHaveLength(1);
  } finally {
    view.unmount();
    client.clear();
  }
});
