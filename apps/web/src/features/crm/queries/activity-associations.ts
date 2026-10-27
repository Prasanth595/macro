import { throwOnErr } from '@core/util/result';
import type { EntityData } from '@entity';
import { Telemetry } from '@macro-inc/observability';
import { SYSTEM_PROPERTY_IDS } from '@property/constants';
import { queryReadyGate } from '@queries/gate';
import type { SoupAstBody } from '@queries/soup/items';
import { soupKeys } from '@queries/soup/keys';
import {
  createSoupRequestSignal,
  SOUP_NETWORK_QUERY_OPTIONS,
} from '@queries/soup/request-timeout';
import {
  isDisplayableSoupItem,
  mapApiSoupItemToEntity,
} from '@queries/soup/transform-utils';
import { queryOptions, useQueries } from '@tanstack/solid-query';
import { type Accessor, createMemo } from 'solid-js';
import type { ActivityAssociationsSource } from '../context/crm-sources';
import {
  type ActivityAssociationInput,
  type ActivityAssociationRecord,
  normalizeAssociationEmail,
  resolveActivityAssociations,
} from '../core/activity-associations';
import type { CrmRecordTarget } from '../core/record';
import type { CrmRecordDependencies } from './dependencies';

const LOOKUP_BATCH_SIZE = 100;
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

type AssociationLookup = {
  kind: 'company' | 'contact' | 'email';
  values: string[];
};

export function activityAssociationInput(
  entity: EntityData
): ActivityAssociationInput {
  const links: CrmRecordTarget[] = [];
  for (const property of 'properties' in entity
    ? (entity.properties ?? [])
    : []) {
    const type =
      property.definition.id === SYSTEM_PROPERTY_IDS.COMPANIES
        ? 'company'
        : property.definition.id === SYSTEM_PROPERTY_IDS.CONTACTS
          ? 'contact'
          : undefined;
    if (!type || property.value?.type !== 'EntityReference') continue;
    for (const reference of property.value.value) {
      if (
        reference.entity_type !== (type === 'company' ? 'COMPANY' : 'CONTACT')
      )
        continue;
      if (
        links.some(
          (link) => link.type === type && link.id === reference.entity_id
        )
      )
        continue;
      links.push({ type, id: reference.entity_id });
    }
  }
  const emails =
    entity.type === 'email'
      ? [
          entity.senderEmail ?? '',
          ...(entity.participants ?? []).map(
            (participant) => participant.email
          ),
        ]
          .map(normalizeAssociationEmail)
          .filter(
            (email, index, all) =>
              email.length > 0 && all.indexOf(email) === index
          )
      : [];
  return { links, emails };
}

function or(literals: object[]): object | undefined {
  if (literals.length === 0) return undefined;
  if (literals.length === 1) return { l: literals[0] };
  const middle = Math.floor(literals.length / 2);
  return { '|': [or(literals.slice(0, middle)), or(literals.slice(middle))] };
}

export function activityAssociationLookupBody(
  lookup: AssociationLookup
): SoupAstBody {
  const excluded = { l: { id: NIL_UUID } };
  return {
    asf: excluded,
    calf: excluded,
    df: excluded,
    chanf: { l: { ChannelId: NIL_UUID } },
    cthf: { l: { ThreadId: NIL_UUID } },
    cf: { l: { cid: NIL_UUID } },
    pf: { l: { pid: NIL_UUID } },
    callf: { l: { CallId: NIL_UUID } },
    fef: excluded,
    ef: { l: { ThreadId: NIL_UUID } },
    ccf:
      lookup.kind === 'company'
        ? (or(lookup.values.map((id) => ({ id }))) ?? excluded)
        : excluded,
    // Keep exact-id lookups separate: mixing email predicates into the tree
    // makes contact listings deduplicate distinct team records by email.
    crmf:
      lookup.kind === 'company'
        ? undefined
        : or(
            lookup.values.map((value) =>
              lookup.kind === 'email' ? { email: value } : { id: value }
            )
          ),
  };
}

function associationQueryOptions(
  deps: CrmRecordDependencies,
  lookup: AssociationLookup
) {
  return queryOptions({
    ...SOUP_NETWORK_QUERY_OPTIONS,
    // CRM renames, hides and property changes already invalidate Soup readers.
    queryKey: [...soupKeys._def, 'crm-activity-associations', lookup],
    queryFn: ({ signal }) =>
      Telemetry.span(
        'crm.activity.associations',
        async (span): Promise<ActivityAssociationRecord[]> => {
          span.setAttr('crm.association.kind', lookup.kind);
          span.setAttr('crm.association.target_count', lookup.values.length);
          const records: ActivityAssociationRecord[] = [];
          let cursor: string | null = null;
          do {
            const page = await throwOnErr(() =>
              deps.storage.getSoupAstItems({
                params: { cursor },
                body: {
                  ...activityAssociationLookupBody(lookup),
                  limit: LOOKUP_BATCH_SIZE,
                  sort_method: 'updated_at',
                },
                signal: createSoupRequestSignal(signal),
              })
            );
            for (const item of page.items) {
              if (!isDisplayableSoupItem(item)) continue;
              const entity = mapApiSoupItemToEntity(item);
              if (entity.type === 'crm_company' && !entity.hidden) {
                records.push({
                  type: 'company',
                  id: entity.id,
                  name: entity.name,
                });
              }
              if (entity.type === 'crm_contact' && !entity.hidden) {
                records.push({
                  type: 'contact',
                  id: entity.id,
                  name: entity.name,
                  email: entity.email,
                });
              }
            }
            cursor = page.next_cursor ?? null;
          } while (cursor);
          span.setAttr('crm.association.record_count', records.length);
          return records;
        }
      ),
    staleTime: 60_000,
  });
}

/** Keep metadata lookups bounded as more feed pages load. */
export function activityAssociationLookups(
  inputs: ActivityAssociationInput[]
): AssociationLookup[] {
  const lookups: AssociationLookup[] = [];
  for (const kind of ['company', 'contact', 'email'] as const) {
    const values = inputs.flatMap((input) =>
      kind === 'email'
        ? input.emails
        : input.links
            .filter((link) => link.type === kind)
            .map((link) => link.id)
    );
    const unique = values
      .filter((value, index) => values.indexOf(value) === index)
      .sort();
    for (let offset = 0; offset < unique.length; offset += LOOKUP_BATCH_SIZE) {
      lookups.push({
        kind,
        values: unique.slice(offset, offset + LOOKUP_BATCH_SIZE),
      });
    }
  }
  return lookups;
}

/** Hydrate only references and email participants from the already-loaded rows. */
export function createActivityAssociations(
  deps: CrmRecordDependencies,
  entities: Accessor<EntityData[]>
): ActivityAssociationsSource {
  const lookups = createMemo(() =>
    activityAssociationLookups(entities().map(activityAssociationInput))
  );
  const queries = useQueries(
    () => ({
      queries: lookups().map((lookup) => associationQueryOptions(deps, lookup)),
    }),
    () => deps.client
  );
  const records = createMemo(() =>
    queries.flatMap((query) => (queryReadyGate(query) ? query.data : []))
  );
  return {
    forEntity: (entity) =>
      resolveActivityAssociations(activityAssociationInput(entity), records()),
    isError: () => queries.some((query) => query.isError),
    refetch: async () => {
      await Promise.all(queries.map((query) => query.refetch()));
    },
  };
}
