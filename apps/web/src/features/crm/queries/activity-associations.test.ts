// @vitest-environment jsdom
import type { EntityData } from '@entity';
import { makeGraphqlSoupInput } from '@queries/soup/graphql/ast';
import { storageServiceClient } from '@service-storage/client';
import type { SoupApiItem } from '@service-storage/generated/schemas';
import { QueryClient } from '@tanstack/solid-query';
import { ok } from 'neverthrow';
import { createRoot, createSignal } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import {
  activityAssociationLookupBody,
  activityAssociationLookups,
  createActivityAssociations,
} from './activity-associations';

describe('activity association lookups', () => {
  it('deduplicates shared references and batches only loaded-row targets', () => {
    const inputs = Array.from({ length: 101 }, (_, index) => ({
      links: [
        { type: 'company' as const, id: `company-${index}` },
        { type: 'contact' as const, id: 'shared-contact' },
      ],
      emails: ['person@example.com'],
    }));
    const lookups = activityAssociationLookups(inputs);
    expect(
      lookups.map((lookup) => [lookup.kind, lookup.values.length])
    ).toEqual([
      ['company', 100],
      ['company', 1],
      ['contact', 1],
      ['email', 1],
    ]);
    expect(activityAssociationLookups([])).toEqual([]);
  });

  it('keeps id hydration separate from email-deduplicated contact discovery', () => {
    const id = '00000000-0000-0000-0000-000000000001';
    const exact = makeGraphqlSoupInput({
      params: { limit: 100, sort_method: 'updated_at' },
      body: activityAssociationLookupBody({ kind: 'contact', values: [id] }),
    });
    expect(exact).toMatchObject({
      initial: {
        filters: {
          crmContactFilter: { literal: { id } },
          crmCompanyFilter: {
            literal: { id: '00000000-0000-0000-0000-000000000000' },
          },
        },
      },
    });
    const email = activityAssociationLookupBody({
      kind: 'email',
      values: ['person@example.com'],
    });
    expect(email.crmf).toEqual({ l: { email: 'person@example.com' } });
    expect(email).not.toHaveProperty('eca');
    expect(email).not.toHaveProperty('ecd');
  });

  it('fails closed for an empty company batch and bounds filter-tree depth', () => {
    expect(
      activityAssociationLookupBody({ kind: 'company', values: [] }).ccf
    ).toEqual({
      l: { id: '00000000-0000-0000-0000-000000000000' },
    });
    const body = activityAssociationLookupBody({
      kind: 'contact',
      values: Array.from(
        { length: 100 },
        (_, index) =>
          `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`
      ),
    });
    const input = makeGraphqlSoupInput({
      params: { limit: 100, sort_method: 'updated_at' },
      body,
    });
    const pending: { value: unknown; depth: number }[] = [
      { value: input, depth: 0 },
    ];
    let deepest = 0;
    while (pending.length) {
      const current = pending.pop()!;
      deepest = Math.max(deepest, current.depth);
      if (current.value !== null && typeof current.value === 'object') {
        pending.push(
          ...Object.values(current.value).map((value) => ({
            value,
            depth: current.depth + 1,
          }))
        );
      }
    }
    expect(deepest).toBeLessThan(24);
  });

  it('pages authorized metadata without blocking rows and drops names when the input leaves', async () => {
    const record: SoupApiItem = {
      tag: 'crmContact',
      frecency_score: 0,
      is_favorited: false,
      data: {
        id: 'contact',
        companyId: 'company',
        companyName: 'Example Company',
        teamId: 'team',
        name: 'Example Contact',
        email: 'person@example.com',
        hidden: false,
        properties: [],
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
        firstInteraction: '2026-10-01T00:00:00Z',
        lastInteraction: '2026-10-01T00:00:00Z',
      },
    };
    const request = vi
      .fn<typeof storageServiceClient.getSoupAstItems>()
      .mockResolvedValueOnce(ok({ items: [], next_cursor: 'page-two' }))
      .mockResolvedValueOnce(
        ok({
          items: [
            record,
            { ...record, data: { ...record.data, id: 'hidden', hidden: true } },
          ],
        })
      );
    const entity: EntityData = {
      id: 'email',
      type: 'email',
      name: 'Example thread',
      ownerId: '',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      isRead: true,
      isDraft: false,
      isImportant: false,
      done: false,
      senderEmail: 'PERSON@example.com',
    };
    const client = new QueryClient();
    const { source, setItems, dispose } = createRoot((dispose) => {
      const [items, setItems] = createSignal<EntityData[]>([entity]);
      const source = createActivityAssociations(
        {
          client,
          storage: { ...storageServiceClient, getSoupAstItems: request },
        },
        items
      );
      return { source, setItems, dispose };
    });
    try {
      await vi.waitFor(() =>
        expect(source.forEntity(entity)).toEqual([
          {
            type: 'contact',
            id: 'contact',
            name: 'Example Contact',
            match: 'email',
          },
        ])
      );
      expect(request).toHaveBeenCalledTimes(2);
      expect(request.mock.calls[0][0].body.crmf).toEqual({
        l: { email: 'person@example.com' },
      });
      expect(request.mock.calls[1][0].params.cursor).toBe('page-two');
      setItems([]);
      await vi.waitFor(() => expect(source.forEntity(entity)).toEqual([]));
    } finally {
      dispose();
      client.clear();
    }
  });
});
