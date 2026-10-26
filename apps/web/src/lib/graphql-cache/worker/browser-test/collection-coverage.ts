// Real production host/WASM/OPFS with synthetic records and no hosted requests.
import { fireAndForget } from '@core/util/fireAndForget';
import { selectRecords } from '@graphql-cache/exchange/record-selection';
import { beginCollectionCoverageScan } from '@queries/soup/collection-coverage';
import { makeGraphqlSoupInput } from '@queries/soup/graphql/ast';
import { createPredicateQuery } from '@queries/soup/graphql/create-predicate-query';
import { groupCompleteSoupSnapshot } from '@queries/soup/graphql/grouped-local-projection';
import { groupedDocument } from '@queries/soup/graphql/grouped-test-fixtures';
import {
  SoupDocument,
  type SoupItemFieldsFragment,
  SoupItemFieldsFragmentDoc,
} from '@service-storage/graphql/generated/graphql';
import { print } from 'graphql';
import { createComputed, createRoot, createSignal } from 'solid-js';
import { createWorkerCacheHost } from '../../host/worker-host';

const result = document.querySelector<HTMLPreElement>('#result');
const groups = document.querySelector<HTMLUListElement>('#groups');
if (!result || !groups) throw new Error('missing fixture output');
const host = createWorkerCacheHost({
  scope: `collection-${crypto.randomUUID()}`,
  requestTimeoutMs: 60_000,
});
const viewer = 'macro|collection-fixture@example.com';
const nil = '00000000-0000-0000-0000-000000000000';
const definition = '10000000-0000-0000-0000-000000000001';
const todo = '20000000-0000-0000-0000-000000000001';
const done = '20000000-0000-0000-0000-000000000002';
const filters =
  makeGraphqlSoupInput({
    cursor: null,
    params: { limit: 100, expand: true, sort_method: 'updated_at' },
    body: {
      df: { l: { dst: 'task' } },
      calf: { l: { id: nil } },
      cf: { l: { cid: nil } },
      pf: { l: { pid: nil } },
      ef: { l: { ThreadId: nil } },
      chanf: { l: { ChannelId: nil } },
      cthf: { l: { ThreadId: nil } },
      callf: { l: { CallId: nil } },
      ccf: { l: { id: nil } },
      fef: { l: { id: nil } },
    },
  }).initial?.filters ?? {};
const [groupBy, setGroupBy] = createSignal<'status' | 'project'>('status');
let dispose = () => {};
let reads = 0;
let members: string[] = [];
const filter = host.entityFilter.bind(host);
host.entityFilter = async (args) => {
  reads += 1;
  return await filter(args);
};

function fail(error: unknown) {
  if (!result) return;
  result.dataset.status = 'failed';
  result.textContent = String(error);
}

async function run(action: () => Promise<unknown>) {
  document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.disabled = true;
  });
  try {
    await action();
  } catch (error) {
    fail(error);
  } finally {
    document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.disabled = false;
    });
  }
}

async function publish() {
  const generation = await host.currentStorageGeneration();
  const scan = await beginCollectionCoverageScan(host, viewer, generation, {
    kind: 'documents',
  });
  if (!scan || !(await scan.append(members)) || !(await scan.complete()))
    throw new Error('fixture scan did not publish');
}

async function initialize() {
  result?.setAttribute('data-stage', 'loading-fixtures');
  const response = await fetch('./collection-capsules.generated.json');
  if (!response.ok) throw new Error('missing generated collection fixtures');
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error('invalid collection fixtures');
  const fixtures = payload.map((row: unknown) => {
    if (
      !row ||
      typeof row !== 'object' ||
      !('id' in row) ||
      typeof row.id !== 'string' ||
      !('propertyId' in row) ||
      typeof row.propertyId !== 'string' ||
      !('projection' in row) ||
      typeof row.projection !== 'string'
    )
      throw new Error('invalid collection fixture record');
    return {
      id: row.id,
      propertyId: row.propertyId,
      projection: row.projection,
    };
  });
  members = fixtures.map(({ id }) => `GraphqlSoupDocument:${id}`);
  for (let offset = 0; offset < fixtures.length; offset += 500) {
    result?.setAttribute('data-stage', `writing-${offset}`);
    const items = fixtures.slice(offset, offset + 500).map((fixture, index) => {
      const option = (offset + index) % 2 === 0 ? todo : done;
      const row = groupedDocument(fixture.id, [option]);
      row.ownerId = viewer;
      row.cacheProjection = fixture.projection;
      row.projectId =
        (offset + index) % 2 === 0
          ? '40000000-0000-0000-0000-000000000001'
          : '40000000-0000-0000-0000-000000000002';
      row.properties[0].id = fixture.propertyId;
      row.properties[0].propertyDefinitionId = definition;
      return row;
    });
    await host.writeQuery({
      query: print(SoupDocument),
      identity: viewer,
      variables: { input: { initial: { limit: offset + 1 } } },
      data: {
        user: { id: viewer, emailLinks: [], soup: { items, nextCursor: null } },
      },
    });
  }
  result?.setAttribute('data-stage', 'querying');
  createRoot((cleanup) => {
    dispose = cleanup;
    const source = createPredicateQuery<SoupItemFieldsFragment>({
      host: () => host,
      query: () => ({
        source: {
          filters,
          sortMethod: 'UPDATED_AT',
          sortDirection: 'DESC',
          limit: 1,
          collection: { userId: viewer },
        },
        select: selectRecords(SoupItemFieldsFragmentDoc),
      }),
    });
    createComputed(() => {
      const snapshot = source.data();
      if (!result || !groups) return;
      if (source.status() !== 'ready' || !snapshot) {
        groups.replaceChildren();
        result.dataset.status = source.status();
        result.textContent = `${members.length} cached documents; coverage ${source.status()}`;
        return;
      }
      const bins = groupCompleteSoupSnapshot(
        snapshot,
        {
          filters,
          sortMethod: 'UPDATED_AT',
          groupBy:
            groupBy() === 'status'
              ? { field: 'PROPERTY', propertyDefinitionId: definition }
              : { field: 'PROJECT' },
        },
        new Date('2026-10-10T12:00:00Z')
      );
      if (!bins) throw new Error('complete grouping failed');
      groups.replaceChildren(
        ...bins.map((bin) => {
          const item = document.createElement('li');
          item.textContent = `${bin.key}: ${bin.totalCount}`;
          return item;
        })
      );
      result.textContent = JSON.stringify({
        count: snapshot.keys.length,
        reads,
        groups: bins.map(({ key, totalCount }) => ({ key, totalCount })),
      });
      result.dataset.status = 'complete';
      result.dataset.count = String(snapshot.keys.length);
      result.dataset.reads = String(reads);
    });
  });
  document
    .querySelector<HTMLButtonElement>('#complete')
    ?.addEventListener('click', () =>
      fireAndForget(run(publish), 'collection-coverage-fixture')
    );
  document
    .querySelector<HTMLButtonElement>('#project')
    ?.addEventListener('click', () => setGroupBy('project'));
  document
    .querySelector<HTMLButtonElement>('#invalidate')
    ?.addEventListener('click', () =>
      fireAndForget(
        run(async () => {
          await host.collectionCoverage?.({ kind: 'invalidate' });
        }),
        'collection-coverage-fixture'
      )
    );
  document
    .querySelector<HTMLButtonElement>('#delete')
    ?.addEventListener('click', () =>
      fireAndForget(
        run(async () => {
          const key = members.at(-1);
          if (!key) throw new Error('missing fixture member');
          await host.deleteRecords([key]);
          members = members.slice(0, -1);
          if (result) result.dataset.action = 'deleted';
        }),
        'collection-coverage-fixture'
      )
    );
  document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.disabled = false;
  });
}
fireAndForget(run(initialize), 'collection-coverage-fixture');
window.addEventListener(
  'pagehide',
  () => {
    dispose();
    host.dispose();
  },
  { once: true }
);
