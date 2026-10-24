import { createClient, fetchExchange } from '@urql/core';
import { createEffect, createRoot, createSignal } from 'solid-js';
import { afterEach, expect, it } from 'vitest';
import { z } from 'zod';
import type { SavedViewsSource } from '../context/saved-views-source';
import { createSavedViewsSource } from './saved-views';

const requestSchema = z.object({
  query: z.string(),
  variables: z.record(z.string(), z.unknown()),
});
type Request = z.infer<typeof requestSchema> & {
  respond: (data: unknown) => void;
};
const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()));

function setup() {
  const pending: Request[] = [];
  const listeners: ((request: Request) => void)[] = [];
  const [viewerId, setViewerId] = createSignal('viewer');
  const client = createClient({
    url: 'https://saved-views.test/graphql',
    preferGetMethod: false,
    exchanges: [fetchExchange],
    fetch: async (_url, options) =>
      new Promise<Response>((resolve) => {
        const body = requestSchema.parse(JSON.parse(String(options?.body)));
        const request = {
          ...body,
          respond: (data: unknown) => resolve(Response.json({ data })),
        };
        const listener = listeners.shift();
        if (listener) listener(request);
        else pending.push(request);
      }),
  });
  const source = createRoot((dispose) => {
    cleanup.push(dispose);
    return createSavedViewsSource({
      graphql: () => client,
      viewerId,
      selectedId: () => undefined,
      kind: 'tasks',
    });
  });
  return {
    source,
    setViewerId,
    next: () =>
      new Promise<Request>((resolve) => {
        const request = pending.shift();
        if (request) resolve(request);
        else listeners.push(resolve);
      }),
  };
}

function itemsReady(source: SavedViewsSource, count: number): Promise<void> {
  return new Promise((resolve) =>
    createRoot((dispose) => {
      cleanup.push(dispose);
      createEffect(() => {
        if (source.items()?.length !== count) return;
        resolve();
        dispose();
      });
    })
  );
}

const recordA = {
  __typename: 'GraphqlSavedView',
  id: 'a',
  ownerId: 'viewer',
  name: 'First view',
  config: { kind: 'tasks', version: 1, filters: {} },
  sharedTeamId: null,
  revision: 1,
  createdAt: '2026-10-24T00:00:00Z',
  updatedAt: '2026-10-24T00:00:00Z',
};
const recordB = { ...recordA, id: 'b', name: 'Second view' };
const recordC = { ...recordA, id: 'c', name: 'New view' };

it('rebuilds loaded membership pages using the new cursor after creation', async () => {
  const { source, next } = setup();
  const first = await next();
  expect(first.variables).toEqual({ kind: 'tasks', first: 50, after: null });
  const firstReady = itemsReady(source, 1);
  first.respond({
    user: {
      id: 'viewer',
      savedViews: { nodes: [recordA], nextCursor: 'old-cursor' },
    },
  });
  await firstReady;

  const more = source.loadMore();
  const second = await next();
  expect(second.variables.after).toBe('old-cursor');
  second.respond({
    user: { id: 'viewer', savedViews: { nodes: [recordB], nextCursor: null } },
  });
  await more;
  expect(source.items()?.map((view) => view.id)).toEqual(['a', 'b']);

  const create = source.create({
    id: 'c',
    name: 'New view',
    config: {},
    sharedTeamId: null,
  });
  const mutation = await next();
  expect(mutation.query).toContain('mutation CreateSavedView');
  mutation.respond({ createSavedView: recordC });
  expect((await create).isOk()).toBe(true);

  const freshFirst = await next();
  expect(freshFirst.variables.after).toBeNull();
  freshFirst.respond({
    user: {
      id: 'viewer',
      savedViews: { nodes: [recordC, recordA], nextCursor: 'new-cursor' },
    },
  });
  const freshSecond = await next();
  expect(freshSecond.variables.after).toBe('new-cursor');
  const refreshed = itemsReady(source, 3);
  freshSecond.respond({
    user: { id: 'viewer', savedViews: { nodes: [recordB], nextCursor: null } },
  });
  await refreshed;
  expect(source.items()?.map((view) => view.id)).toEqual(['c', 'a', 'b']);
});

it('omits sharing from filter updates unless the owner explicitly changes it', async () => {
  const { source, next } = setup();
  const first = await next();
  const ready = itemsReady(source, 0);
  first.respond({
    user: { id: 'viewer', savedViews: { nodes: [], nextCursor: null } },
  });
  await ready;
  const update = source.update({
    id: 'a',
    name: 'Renamed',
    config: {},
    expectedRevision: 1,
  });
  const mutation = await next();
  expect(mutation.variables.input).not.toHaveProperty('sharing');
  mutation.respond({ updateSavedView: { ...recordA, revision: 2 } });
  expect((await update).isOk()).toBe(true);
  (await next()).respond({
    user: { id: 'viewer', savedViews: { nodes: [recordA], nextCursor: null } },
  });
});

it('hides cached pages while revalidating for a different account', async () => {
  const { source, next, setViewerId } = setup();
  const first = await next();
  const loaded = itemsReady(source, 1);
  first.respond({
    user: { id: 'viewer', savedViews: { nodes: [recordA], nextCursor: null } },
  });
  await loaded;
  setViewerId('other-viewer');
  expect(source.items()).toBeUndefined();
  const fresh = await next();
  const reloaded = itemsReady(source, 1);
  fresh.respond({
    user: {
      id: 'other-viewer',
      savedViews: {
        nodes: [{ ...recordB, ownerId: 'other-viewer' }],
        nextCursor: null,
      },
    },
  });
  await reloaded;
  expect(source.items()?.map((view) => view.id)).toEqual(['b']);
});
