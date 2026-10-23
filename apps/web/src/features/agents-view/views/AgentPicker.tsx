import { ModelCatalogMenu } from '@core/component/AI/component/input/ModelCatalogPicker';
import { ModelIcon } from '@core/component/AI/component/ProviderIcon';
import { modelLabel } from '@core/component/AI/constant/model-label';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { composerMenuAnchorRect } from '@core/util/composerMenuAnchor';
import CaretDownIcon from '@phosphor/caret-down.svg';
import PlusIcon from '@phosphor/plus.svg';
import { cn, Dropdown } from '@ui';
import { tourTarget } from '@ui/components/Tour';
import { createSignal, For, Show } from 'solid-js';
import { AgentIcon } from '../components/AgentGlyph';
import { AgentPickerIdentity } from '../components/AgentPickerIdentity';
import { agentPickerGroups } from '../core/agent-picker-groups';
import { MACRO_PERSONA_ID, type RosterAgent } from '../core/roster';
import { createComposerModels } from '../queries/composer-models';
import { AGENTS_TOUR } from '../tour';
import { MobileAgentPicker } from './MobileAgentPicker';

/** Agent selection alongside the selected agent's per-message model catalog. */
export type AgentPickerProps = {
  agents: RosterAgent[];
  selected?: RosterAgent;
  modelOverride?: string;
  loading: boolean;
  triggerClass?: string;
  /** Configuration forms also show the saved model name on mobile. */
  showModelLabel?: boolean;
  onSelect: (agent: RosterAgent, model?: string) => void;
  onConnect: (agent: RosterAgent) => void;
  onCreate: () => void;
  onCloseAutoFocus?: (event: Event) => void;
};

export function AgentPicker(props: AgentPickerProps) {
  return (
    <Show when={isTouchDevice()} fallback={<DesktopAgentPicker {...props} />}>
      <MobileAgentPicker {...props} />
    </Show>
  );
}

function DesktopAgentPicker(props: AgentPickerProps) {
  const [open, setOpen] = createSignal(false);
  const [browsingId, setBrowsingId] = createSignal<string>();
  const browsing = () =>
    props.agents.find((agent) => agent.id === browsingId()) ?? props.selected;
  const catalog = createComposerModels(browsing);
  const selectedCatalog = createComposerModels(() => props.selected);
  const macro = () =>
    props.agents.find((agent) => agent.id === MACRO_PERSONA_ID);
  const agents = () =>
    agentPickerGroups(props.agents).flatMap((group) => group.agents);
  const rawModel = () => props.selected?.id === MACRO_PERSONA_ID;
  const model = () =>
    props.modelOverride ??
    props.selected?.defaultModel ??
    selectedCatalog.currentModel();
  const baseLabel = () =>
    modelLabel(
      model(),
      selectedCatalog.models().find((option) => option.id === model())?.name
    );
  const label = baseLabel;
  const changeOpen = (next: boolean) => {
    if (next) setBrowsingId(props.selected?.id ?? macro()?.id);
    setOpen(next);
  };
  const browse = (agent: RosterAgent) => {
    if (agent.unavailableReason) {
      if (agent.connectLabel) {
        setOpen(false);
        props.onConnect(agent);
      }
      return;
    }
    setBrowsingId(agent.id);
    if (agent.id !== props.selected?.id) props.onSelect(agent);
  };
  const browsingModel = () =>
    browsing()?.id === props.selected?.id
      ? (props.modelOverride ??
        browsing()?.defaultModel ??
        catalog.currentModel())
      : (browsing()?.defaultModel ?? catalog.currentModel());
  const agentRow = (agent: RosterAgent, name?: string) => (
    <Dropdown.Item
      closeOnSelect={false}
      class="min-h-9 min-w-0 gap-2"
      disabled={Boolean(agent.unavailableReason && !agent.connectLabel)}
      title={agent.unavailableReason}
      onSelect={() => browse(agent)}
    >
      <AgentPickerIdentity
        agent={agent}
        name={name}
        selected={agent.id === browsing()?.id}
      />
    </Dropdown.Item>
  );
  return (
    <Dropdown
      open={open()}
      onOpenChange={changeOpen}
      placement={macro() ? 'bottom-start' : 'top-end'}
      gutter={macro() ? 8 : 4}
      getAnchorRect={macro() ? composerMenuAnchorRect : undefined}
    >
      <Dropdown.Trigger
        variant="ghost"
        aria-label="Agent"
        ref={tourTarget(AGENTS_TOUR.picker)}
        title={
          rawModel()
            ? label()
            : `${props.selected?.name ?? 'Choose agent'} · ${label()}`
        }
        class={cn(
          'h-[33.75px] min-w-0 max-w-full gap-[5.625px] px-[7.5px] text-base font-normal text-ink-muted light-mode:text-composer-placeholder',
          props.triggerClass
        )}
      >
        <Show when={!rawModel()}>
          <Show
            when={props.selected}
            fallback={
              <span class="min-w-0 truncate text-left leading-5">
                Choose agent
              </span>
            }
          >
            {(agent) => (
              <>
                <AgentIcon agent={agent()} class="size-[15px] shrink-0" />
                <span class="min-w-0 truncate text-left leading-5">
                  {agent().name}
                </span>
              </>
            )}
          </Show>
        </Show>
        <Show when={rawModel()}>
          <ModelIcon model={model()} class="size-[15px] shrink-0" />
        </Show>
        <span class="min-w-0 truncate text-left leading-5">{baseLabel()}</span>
        <CaretDownIcon class="size-4 shrink-0 text-ink-muted" />
      </Dropdown.Trigger>
      <Dropdown.Content
        class="w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border-0"
        onCloseAutoFocus={props.onCloseAutoFocus}
        onPointerDown={(event: PointerEvent) => event.stopPropagation()}
        onMouseDown={(event: MouseEvent) => event.stopPropagation()}
      >
        <div class="grid max-h-[min(24rem,var(--kb-popper-content-available-height))] min-h-0 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <div
            role="group"
            aria-label="Models"
            class="order-2 min-h-0 max-h-[min(24rem,var(--kb-popper-content-available-height))] min-w-0 overflow-y-auto overscroll-contain px-2 pb-2 sm:border-l sm:border-edge-divider"
          >
            <Show when={browsing()} keyed>
              {(agent) => (
                <ModelCatalogMenu
                  flat
                  autoFocusSearch
                  value={browsingModel() ?? null}
                  disabled={Boolean(agent.unavailableReason)}
                  options={catalog.models().map((option) => ({
                    id: option.id,
                    label: modelLabel(option.id, option.name),
                    description: option.description ?? undefined,
                    group: option.group ?? undefined,
                  }))}
                  onSelect={(id) => {
                    props.onSelect(agent, id);
                    setOpen(false);
                  }}
                  emptyMessage={catalog.message()}
                />
              )}
            </Show>
          </div>
          <div
            role="group"
            aria-label="Agents"
            class="order-1 flex min-h-0 max-h-[min(24rem,var(--kb-popper-content-available-height))] min-w-0 flex-col px-2 pb-2 pt-3"
          >
            <div class="px-3 pb-1 text-xs font-medium text-ink-extra-muted">
              Agents
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <Show when={macro()}>
                {(agent) => agentRow(agent(), 'Default agent')}
              </Show>
              <For each={agents()}>{(agent) => agentRow(agent)}</For>
              <Show when={!props.loading && !macro() && agents().length === 0}>
                <p role="status" class="px-3 py-2 text-sm text-ink-muted">
                  No agents available
                </p>
              </Show>
              <Show when={props.loading}>
                <div
                  role="status"
                  class="bg-menu px-3 py-2 text-xs text-ink-muted"
                >
                  Loading agents…
                </div>
              </Show>
            </div>
            <Dropdown.Group class="shrink-0 border-t border-edge-divider bg-transparent pt-1 pb-0">
              <Dropdown.Item
                closeOnSelect
                class="min-h-9 gap-2 text-ink-muted"
                onSelect={() => {
                  setOpen(false);
                  props.onCreate();
                }}
              >
                <PlusIcon class="size-4" />
                Create agent
              </Dropdown.Item>
            </Dropdown.Group>
          </div>
        </div>
      </Dropdown.Content>
    </Dropdown>
  );
}
