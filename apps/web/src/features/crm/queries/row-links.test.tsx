import { renderHook, waitFor } from '@solidjs/testing-library';
import { QueryClient } from '@tanstack/solid-query';
import { err, ok } from 'neverthrow';
import { createSignal } from 'solid-js';
import { expect, it, vi } from 'vitest';
import type { RowLinkTarget } from '../core/row-links';
import type { CrmRecordDependencies } from './dependencies';
import { createRowLinks } from './row-links';

type LinkedRowsResult = Awaited<
  ReturnType<CrmRecordDependencies['storage']['getCrmLinkedRows']>
>;

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
