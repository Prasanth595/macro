import { useSplitLayout } from '@components/app/split-layout/layout';
import { storageServiceClient } from '@service-storage/client';
import { createResource, For, Show } from 'solid-js';
import { DealDateBadge } from '../components/deal-card';

/** The company's deals. Stage, date and outcome are shown, not edited. */
export function CompanyDeals(props: {
  companyId: string;
  onOpenDeal(deal: { id: string; name: string; pipelineId?: string }): void;
}) {
  const layout = useSplitLayout();
  const [deals] = createResource(
    () => props.companyId,
    async (companyId) => {
      const loaded = await storageServiceClient.listCompanyDeals({ companyId });
      if (loaded.isErr()) throw loaded.error;
      return loaded.value;
    }
  );
  return (
    <Show when={(deals() ?? []).length > 0}>
      <section class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-ink">Deals</h3>
        <ul class="flex flex-col gap-2">
          <For each={deals()}>
            {(deal) => (
              <li class="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="min-w-0 truncate text-left text-sm font-medium text-ink hover:underline"
                  onClick={() =>
                    props.onOpenDeal({
                      id: deal.id,
                      name: deal.name,
                      pipelineId: deal.pipelineId ?? undefined,
                    })
                  }
                >
                  {deal.name}
                </button>
                <Show when={deal.stage}>
                  {(stage) => (
                    <span class="text-xs text-ink-muted">{stage()}</span>
                  )}
                </Show>
                <Show when={deal.revenue}>
                  {(revenue) => (
                    <span class="text-xs text-ink-muted">{revenue()}</span>
                  )}
                </Show>
                <DealDateBadge when={deal.whenOn} outcome={deal.outcome} />
                <Show when={deal.deliveryInitiativeId}>
                  {(projectId) => (
                    <button
                      type="button"
                      class="text-xs text-ink-muted hover:underline"
                      onClick={() =>
                        layout.openWithSplit({
                          type: 'initiative',
                          id: projectId(),
                        })
                      }
                    >
                      Project
                    </button>
                  )}
                </Show>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
}
