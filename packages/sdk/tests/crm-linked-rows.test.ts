import { afterEach, expect, test } from 'bun:test';
import type { LinkedRows, TableDetail } from '../generated/storage/types.gen';
import { DatabaseTable } from '../src/entities/databases/table';
import { Macro } from '../src/macro';

const originalFetch = globalThis.fetch;
const host = 'https://storage.example.test';
const table: TableDetail = {
  table: {
    id: 'source-table',
    database_id: 'source-db',
    name: 'Invoices',
    position: 'a0',
    version: 1,
  },
  sql_name: 'invoices',
  columns: [],
  views: [],
};
const previews: LinkedRows = {
  tables: [
    {
      databaseName: 'Billing',
      table,
      rows: [{ rowId: 'invoice-1', cells: {} }],
    },
  ],
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('company and pipeline-entry references preserve source identity and mutation scope', async () => {
  const requests: { path: string; method: string; body?: unknown }[] = [];
  globalThis.fetch = (async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    const path = new URL(request.url).pathname;
    requests.push({
      path,
      method: request.method,
      body: request.method === 'PUT' ? await request.json() : undefined,
    });
    if (path === '/crm/pipelines/pipeline-1/table') return Response.json(table);
    if (request.method === 'GET') return Response.json(previews);
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const macro = new Macro({ token: 'fixture-token', hosts: { storage: host } });
  const source = DatabaseTable.byId(
    macro.databases.byId('source-db'),
    'source-table',
  ).row('invoice-1');
  const company = macro.crm.companyById('company-1');
  const entry = (await macro.crm.pipelines.byId('pipeline-1').table()).rowById(
    'entry-1',
  );
  for (const target of [company, entry]) {
    await target.linkRow(source);
    const linked = await target.linkedRows();
    expect(linked).toHaveLength(1);
    expect(linked[0]?.row.toJSON()).toEqual({
      id: 'invoice-1',
      tableId: 'source-table',
    });
    expect(linked[0]?.row.table.database.id).toBe('source-db');
    expect(linked[0]?.databaseName).toBe('Billing');
    expect(linked[0]?.tableName).toBe('Invoices');
    await target.unlinkRow(source);
  }
  const body = {
    databaseId: 'source-db',
    tableId: 'source-table',
    rowId: 'invoice-1',
  };
  expect(requests.filter((request) => request.method !== 'GET')).toEqual([
    { path: '/crm/companies/company-1/linked-rows', method: 'PUT', body },
    {
      path: '/crm/companies/company-1/linked-rows/invoice-1',
      method: 'DELETE',
      body: undefined,
    },
    {
      path: '/crm/pipelines/pipeline-1/entries/entry-1/linked-rows',
      method: 'PUT',
      body,
    },
    {
      path: '/crm/pipelines/pipeline-1/entries/entry-1/linked-rows/invoice-1',
      method: 'DELETE',
      body: undefined,
    },
  ]);
});
