import type { LinkedRows } from '@service-storage/generated/schemas/linkedRows';
import { render, renderHook, waitFor } from '@solidjs/testing-library';
import { QueryClient } from '@tanstack/solid-query';
import { err, ok } from 'neverthrow';
import { createSignal } from 'solid-js';
import { expect, it, vi } from 'vitest';
import { LinkedRowsSection } from '../components/linked-rows';
import type { RowLinksSource } from '../context/row-links';
import type { RowLinkTarget } from '../core/row-links';
import type { CrmRecordDependencies } from './dependencies';
import { createRowLinks } from './row-links';

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

it('does not repeat a committed link when preview refresh fails', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let failRead = false;
  const linkCrmRow = vi.fn(async () => {
    failRead = true;
    return ok(undefined);
  });
  const storage = {
    getCrmLinkedRows: vi.fn(
      async (): Promise<LinkedRowsResult> =>
        failRead
          ? err([{ code: 'NETWORK_ERROR', message: 'offline' }])
          : ok({ tables: [] })
    ),
    linkCrmRow,
    unlinkCrmRow: vi.fn(async () => ok(undefined)),
  };
  const { result, cleanup } = renderHook(() =>
    createRowLinks({ client, storage }, () => ({
      type: 'company',
      companyId: 'company',
    }))
  );
  await waitFor(() => expect(result.state().kind).toBe('ready'));
  await expect(
    result.link({ databaseId: 'database', tableId: 'table', rowId: 'row' })
  ).resolves.toBeUndefined();
  await waitFor(() => expect(result.state().kind).toBe('error'));
  await result.refresh();
  expect(linkCrmRow).toHaveBeenCalledTimes(1);
  cleanup();
  client.clear();
});

it('keeps late requests scoped to the company or entry that started them', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const pending = Promise.withResolvers<LinkedRowsResult>();
  const storage = {
    getCrmLinkedRows: vi.fn(
      async (target: RowLinkTarget): Promise<LinkedRowsResult> =>
        target.type === 'company' ? pending.promise : ok({ tables: [] })
    ),
    linkCrmRow: vi.fn(async () => ok(undefined)),
    unlinkCrmRow: vi.fn(async () => ok(undefined)),
  };
  const { result, cleanup } = renderHook(() => {
    const [target, setTarget] = createSignal<RowLinkTarget>({
      type: 'company',
      companyId: 'company',
    });
    return { source: createRowLinks({ client, storage }, target), setTarget };
  });
  await waitFor(() =>
    expect(storage.getCrmLinkedRows).toHaveBeenCalledTimes(1)
  );
  result.setTarget({ type: 'entry', pipelineId: 'pipeline', rowId: 'entry' });
  await waitFor(() => expect(result.source.state().kind).toBe('ready'));
  pending.resolve(ok({ tables: [] }));
  await pending.promise;
  await result.source.link({
    databaseId: 'database',
    tableId: 'table',
    rowId: 'source',
  });
  expect(storage.linkCrmRow).toHaveBeenCalledWith(
    { type: 'entry', pipelineId: 'pipeline', rowId: 'entry' },
    { databaseId: 'database', tableId: 'table', rowId: 'source' }
  );
  cleanup();
  client.clear();
});
