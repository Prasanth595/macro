import { useSplitLayout } from '@components/app/split-layout/layout';
import { toast } from '@core/component/Toast/Toast';
import { EntityDiscussion } from '@core/messages/EntityDiscussion';
import { fireAndForget } from '@core/util/fireAndForget';
import BuildingsIcon from '@phosphor/buildings.svg';
import CaretDownIcon from '@phosphor/caret-down.svg';
import CheckIcon from '@phosphor/check.svg';
import UsersIcon from '@phosphor/users.svg';
import { TagDot } from '@property/tags/TagDot';
import { invalidateMessageTimeline } from '@queries/messages/timeline';
import { storageServiceClient } from '@service-storage/client';
import { entityMessagesClient } from '@service-storage/messages';
import { badgeClasses, Dropdown } from '@ui';
import { createResource, For, Show } from 'solid-js';
import { toCellDate } from '../../database/core/cell-date';
import type { DatabaseCellValue } from '../../database/core/database-view';
import { writeDatabaseRow } from '../../database/core/row-write';
import { toViewColumn } from '../../database/queries/column-detail';
import { DealPill } from '../components/deal-card';
import { pipelineCell } from '../queries/pipeline-data';
import { useCrmUserId as useUserId } from './use-crm';

/** The deal's own page: the paragraph, the people it involves, and its comments. */
export function Deal(props: {
  dealId: string;
  pipelineId?: string;
  onOpenCompany(id: string): void;
  onOpenContact(id: string): void;
}) {
  const userId = useUserId();
  const layout = useSplitLayout();
  const [deal, { refetch: refetchDeal }] = createResource(
    props.dealId,
    async (id) => {
      const loaded = await storageServiceClient.getDeal({ dealId: id });
      if (loaded.isErr()) throw loaded.error;
      return loaded.value;
    }
  );
  const [names] = createResource(deal, async (record) => {
    const companies = await Promise.all(
      record.companyIds.map(async (id) => {
        const company = await storageServiceClient.getCompany({
          companyId: id,
        });
        return {
          id,
          label: company.isOk()
            ? company.value.name ||
              company.value.domains[0]?.domain ||
              'Company'
            : 'Company',
        };
      })
    );
    const people = await Promise.all(
      record.contactIds.map(async (id) => {
        const contact = await storageServiceClient.getContact({
          contactId: id,
        });
        return {
          id,
          label: contact.isOk()
            ? contact.value.name || contact.value.email
            : 'Person',
        };
      })
    );
    return { companies, people };
  });
  return (
    <div class="h-full overflow-y-auto px-6 pb-12 pt-12">
      <div class="mx-auto flex max-w-3xl min-w-0 flex-col gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-2xl font-semibold">{deal()?.name ?? 'Deal'}</h2>
          <Show when={deal()?.deliveryInitiativeId}>
            {(projectId) => (
              <button
                type="button"
                class="text-sm text-ink-muted hover:underline"
                onClick={() =>
                  layout.openWithSplit({ type: 'initiative', id: projectId() })
                }
              >
                Project
              </button>
            )}
          </Show>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <For each={names()?.companies ?? []}>
            {(company) => (
              <button
                type="button"
                class={badgeClasses({
                  variant: 'outline',
                  size: 'sm',
                  class: 'max-w-full text-ink',
                })}
                onClick={() => props.onOpenCompany(company.id)}
              >
                <BuildingsIcon class="size-3 shrink-0" />
                <span class="truncate">{company.label}</span>
              </button>
            )}
          </For>
          <For each={names()?.people ?? []}>
            {(person) => (
              <button
                type="button"
                class={badgeClasses({
                  variant: 'outline',
                  size: 'sm',
                  class: 'max-w-full text-ink',
                })}
                onClick={() => props.onOpenContact(person.id)}
              >
                <UsersIcon class="size-3 shrink-0" />
                <span class="truncate">{person.label}</span>
              </button>
            )}
          </For>
          <Show when={props.pipelineId} keyed>
            {(pipelineId) => (
              <DealRowFacts
                pipelineId={pipelineId}
                dealId={props.dealId}
                onOutcome={() =>
                  fireAndForget(refetchDeal(), 'crm.deal-detail')
                }
              />
            )}
          </Show>
        </div>
        <Show when={deal()?.description}>
          <p class="max-w-[65ch] text-sm text-ink-muted">
            {deal()?.description}
          </p>
        </Show>
        <Show when={deal()}>
          {(record) => (
            <EntityDiscussion
              parent={{ type: 'crm_deal', id: record().id }}
              canWrite={!!userId()}
              link={{ type: 'deal', id: record().id }}
              label="Activity"
              timeline="deal"
            />
          )}
        </Show>
      </div>
    </div>
  );
}

function DealRowFacts(props: {
  pipelineId: string;
  dealId: string;
  onOutcome?: () => void;
}) {
  const [facts, { refetch }] = createResource(
    () => ({ pipelineId: props.pipelineId, dealId: props.dealId }),
    async ({ pipelineId, dealId }) => {
      const table = await storageServiceClient.getCrmPipelineTable(pipelineId);
      if (table.isErr()) throw table.error;
      const rows = await storageServiceClient.getCrmPipelineRows(pipelineId);
      if (rows.isErr()) throw rows.error;
      const columns = table.value.columns.map(toViewColumn);
      const primary = columns.find((column) => column.name === 'Deal');
      const row = rows.value.rows.find((entry) => {
        const detail = table.value.columns.find(
          (column) => column.column.id === primary?.id
        );
        if (!primary || !detail) return false;
        return pipelineCell(entry.cells[primary.id], detail) === dealId;
      });
      return {
        tableId: table.value.table.id,
        version: rows.value.version,
        columns,
        details: table.value.columns,
        row,
      };
    }
  );
  const read = (name: string): DatabaseCellValue => {
    const current = facts();
    if (!current?.row) return null;
    const column = current.columns.find((entry) => entry.name === name);
    const detail = current.details.find(
      (entry) => entry.column.id === column?.id
    );
    if (!column || !detail) return null;
    const value = pipelineCell(current.row.cells[column.id], detail);
    return value === undefined ? null : value;
  };
  const text = (name: string) => {
    const value = read(name);
    return typeof value === 'string' ? value : null;
  };
  async function write(name: string, value: DatabaseCellValue) {
    const current = facts();
    const column = current?.columns.find((entry) => entry.name === name);
    if (!current?.row || !column) return;
    const saved = await writeDatabaseRow(
      {
        tableId: current.tableId,
        columns: current.columns,
        applyOps: (batch) =>
          storageServiceClient
            .applyCrmPipelineOps(props.pipelineId, batch)
            .mapErr(([error]) => error),
      },
      {
        kind: 'cell',
        rowId: current.row.rowId,
        columnId: column.id,
        value:
          name === 'When' && typeof value === 'string'
            ? toCellDate(new Date(`${value}T12:00:00`))
            : value,
      },
      false
    );
    if (saved.isOk()) {
      fireAndForget(refetch(), 'crm.deal-detail');
      if (
        name === 'Stage' ||
        name === 'When' ||
        name === 'Outcome' ||
        name === 'Next activity'
      ) {
        fireAndForget(
          invalidateMessageTimeline({ type: 'crm_deal', id: props.dealId }),
          'crm.deal-detail'
        );
      }
      if (name === 'Outcome') props.onOutcome?.();
    }
  }
  const stage = () =>
    facts()?.columns.find((column) => column.name === 'Stage');
  const revenue = () => read('Revenue');
  return (
    <Show when={facts()?.row}>
      <div class="contents">
        <Show when={stage()}>
          {(column) => {
            const current = () => text('Stage');
            const selected = () =>
              column().options.find((option) => option.label === current());
            return (
              <Dropdown placement="bottom-start">
                <Dropdown.Trigger
                  aria-label="Stage"
                  class="rounded-full text-ink"
                >
                  <Show when={selected()?.color}>
                    {(color) => <TagDot color={color()} class="size-2.5" />}
                  </Show>
                  {current() || 'Stage'}
                  <CaretDownIcon class="size-3 shrink-0 text-ink-muted" />
                </Dropdown.Trigger>
                <Dropdown.Content class="min-w-40">
                  <Dropdown.RadioGroup
                    value={current() ?? ''}
                    onChange={(value) =>
                      fireAndForget(write('Stage', value), 'crm.deal-detail')
                    }
                  >
                    <For each={column().options}>
                      {(option) => (
                        <Dropdown.RadioItem value={option.label} closeOnSelect>
                          <Show when={option.color}>
                            {(color) => (
                              <TagDot color={color()} class="size-2.5" />
                            )}
                          </Show>
                          <span class="flex-1">{option.label}</span>
                          <Dropdown.ItemIndicator>
                            <CheckIcon class="size-3.5 text-accent" />
                          </Dropdown.ItemIndicator>
                        </Dropdown.RadioItem>
                      )}
                    </For>
                  </Dropdown.RadioGroup>
                </Dropdown.Content>
              </Dropdown>
            );
          }}
        </Show>
        <input
          aria-label="Revenue"
          type="number"
          min="0"
          class="h-7 w-28 rounded-full border border-edge-muted bg-surface px-2 text-sm text-ink outline-none placeholder:text-ink-placeholder"
          placeholder="Revenue"
          value={typeof revenue() === 'number' ? String(revenue()) : ''}
          onChange={(event) => {
            const raw = event.currentTarget.value.trim();
            fireAndForget(
              write('Revenue', raw === '' ? null : Number(raw)),
              'crm.deal-detail'
            );
          }}
        />
        <DealPill
          presentation="cell"
          when={text('When')?.slice(0, 10) ?? null}
          next={text('Next activity')}
          plan={text('Plan') ?? ''}
          outcome={text('Outcome')}
          dealId={props.dealId}
          onWhen={(iso) => fireAndForget(write('When', iso), 'crm.deal-detail')}
          onNext={(activity) =>
            fireAndForget(write('Next activity', activity), 'crm.deal-detail')
          }
          onPlan={(text) =>
            fireAndForget(write('Plan', text), 'crm.deal-detail')
          }
          onOutcome={(outcome) =>
            fireAndForget(write('Outcome', outcome), 'crm.deal-detail')
          }
          onLast={async (action) => {
            try {
              await entityMessagesClient.post(
                { type: 'crm_deal', id: props.dealId },
                { content: action }
              );
              fireAndForget(
                invalidateMessageTimeline({
                  type: 'crm_deal',
                  id: props.dealId,
                }),
                'crm.deal-detail'
              );
            } catch {
              toast.failure('Could not save the note');
            }
          }}
          onHappened={async (note) => {
            await entityMessagesClient.post(
              { type: 'crm_deal', id: props.dealId },
              { content: note }
            );
          }}
        />
      </div>
    </Show>
  );
}
