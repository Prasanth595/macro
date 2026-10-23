import { MobileDrawer } from '@components/app/mobile/MobileDrawer';
import { matchesModelQuery } from '@core/component/AI/component/input/modelCatalog';
import { ModelIcon } from '@core/component/AI/component/ProviderIcon';
import { modelLabel } from '@core/component/AI/constant/model-label';
import Check from '@phosphor/check.svg';
import MagnifyingGlass from '@phosphor/magnifying-glass.svg';
import Plus from '@phosphor/plus.svg';
import { Button } from '@ui';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { AgentIcon } from '../components/AgentGlyph';
import { AgentPickerIdentity } from '../components/AgentPickerIdentity';
import { agentPickerGroups } from '../core/agent-picker-groups';
import { MACRO_PERSONA_ID, type RosterAgent } from '../core/roster';
import { createComposerModels } from '../queries/composer-models';
import type { AgentPickerProps } from './AgentPicker';

/** Agents and the active agent's models stay together in one bottom sheet. */
export function MobileAgentPicker(props: AgentPickerProps) {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal('');
  const [browsingId, setBrowsingId] = createSignal<string>();
  const macro = () =>
    props.agents.find((agent) => agent.id === MACRO_PERSONA_ID);
  const browsing = () =>
    props.agents.find((agent) => agent.id === browsingId()) ??
    props.selected ??
    macro();
  const catalog = createComposerModels(browsing);
  const model = () => props.modelOverride ?? props.selected?.defaultModel;
  const browsingModel = () =>
    browsing()?.id === props.selected?.id
      ? (props.modelOverride ??
        browsing()?.defaultModel ??
        catalog.currentModel())
      : (browsing()?.defaultModel ?? catalog.currentModel());
  const label = () =>
    props.selected?.id === MACRO_PERSONA_ID
      ? modelLabel(model())
      : (props.selected?.name ?? 'Choose agent');
  const matches = (text: string) =>
    text.toLocaleLowerCase().includes(query().trim().toLocaleLowerCase());
  const models = createMemo(() => {
    const options = catalog.models().map((option) => ({
      id: option.id,
      label: modelLabel(option.id, option.name),
      group: option.group ?? undefined,
    }));
    const search = query().trim().toLowerCase();
    return options.filter((option) => matchesModelQuery(option, search));
  });
  const agents = () =>
    agentPickerGroups(
      props.agents.filter((agent) =>
        matches(`${agent.name} ${agent.runtime.label}`)
      )
    ).flatMap((group) => group.agents);
  const changeOpen = (next: boolean) => {
    if (next) setBrowsingId(props.selected?.id ?? macro()?.id);
    setOpen(next);
    if (!next) setQuery('');
  };
  const browse = (agent: RosterAgent) => {
    if (agent.unavailableReason) {
      if (agent.connectLabel) {
        changeOpen(false);
        props.onConnect(agent);
      }
      return;
    }
    setQuery('');
    setBrowsingId(agent.id);
    if (agent.id !== props.selected?.id) props.onSelect(agent);
  };
  const agentRow = (agent: RosterAgent, name?: string) => (
    <MobileDrawer.Item
      disabled={Boolean(agent.unavailableReason && !agent.connectLabel)}
      onClick={() => browse(agent)}
    >
      <AgentPickerIdentity
        agent={agent}
        name={name}
        selected={browsing()?.id === agent.id}
      />
    </MobileDrawer.Item>
  );
  return (
    <MobileDrawer
      side="bottom"
      open={open()}
      onOpenChange={changeOpen}
      restoreFocus={!!props.onCloseAutoFocus}
      onFinalFocus={props.onCloseAutoFocus}
    >
      <MobileDrawer.Trigger
        as={Button}
        variant="ghost"
        size="sm"
        aria-label="Agent"
        title={label()}
        class={
          props.showModelLabel
            ? 'h-[34px] max-w-full min-w-0 gap-1.5 rounded-full px-2 text-ink-muted'
            : 'size-[34px] shrink-0 rounded-full p-0 text-ink-muted'
        }
        onPointerDown={(event: PointerEvent) => event.preventDefault()}
        onMouseDown={(event: MouseEvent) => event.preventDefault()}
      >
        <Show
          when={props.selected?.id !== MACRO_PERSONA_ID && props.selected}
          fallback={<ModelIcon model={model()} class="size-[18px]" />}
        >
          {(agent) => <AgentIcon agent={agent()} class="size-[18px]" />}
        </Show>
        <Show when={props.showModelLabel}>
          <span class="min-w-0 truncate">{modelLabel(model())}</span>
        </Show>
      </MobileDrawer.Trigger>
      <MobileDrawer.Portal>
        <MobileDrawer.Overlay />
        <MobileDrawer.Content aria-label="Choose an agent or model">
          <MobileDrawer.Handle />
          <MobileDrawer.Title class="px-4 pb-3 font-medium">
            Agents and models
          </MobileDrawer.Title>
          <div class="mx-4 mb-2 flex h-9 shrink-0 items-center gap-2 px-3">
            <MagnifyingGlass
              aria-hidden="true"
              class="size-4 shrink-0 text-ink-extra-muted"
            />
            <input
              aria-label="Search agents and models"
              placeholder="Search agents and models"
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
              class="h-full min-w-0 w-full border-0 bg-transparent p-0 text-base outline-none placeholder:text-ink-extra-muted"
            />
          </div>
          <MobileDrawer.ScrollBody class="gap-1">
            <MobileDrawer.Section
              class="rounded-none bg-transparent p-0"
              role="group"
              aria-label="Agents"
            >
              <Show when={matches('Default agent Macro') && macro()}>
                {(agent) => agentRow(agent(), 'Default agent')}
              </Show>
              <For each={agents()}>{(agent) => agentRow(agent)}</For>
            </MobileDrawer.Section>
            <Show when={props.loading}>
              <p role="status" class="px-4 py-3 text-sm text-ink-muted">
                Loading agents…
              </p>
            </Show>
            <Show when={browsing()}>
              <MobileDrawer.Label class="px-4 pt-3 pb-1 font-medium text-ink-muted">
                Models
              </MobileDrawer.Label>
              <MobileDrawer.Section
                class="rounded-none bg-transparent p-0"
                role="group"
                aria-label="Models"
              >
                <For each={models()}>
                  {(option) => (
                    <MobileDrawer.Item
                      disabled={Boolean(browsing()?.unavailableReason)}
                      onClick={() => {
                        const agent = browsing();
                        if (agent) {
                          props.onSelect(agent, option.id);
                          changeOpen(false);
                        }
                      }}
                    >
                      <ModelIcon model={option.id} />
                      <span class="min-w-0 flex-1 truncate">
                        {option.label}
                      </span>
                      <Show when={browsingModel() === option.id}>
                        <Check class="size-4 text-accent" />
                      </Show>
                    </MobileDrawer.Item>
                  )}
                </For>
              </MobileDrawer.Section>
              <Show when={models().length === 0}>
                <p role="status" class="px-4 py-3 text-sm text-ink-muted">
                  {query() ? 'No matching models' : catalog.message()}
                </p>
              </Show>
            </Show>
            <div class="flex px-4 pt-1">
              <Button
                variant="ghost"
                size="sm"
                class="gap-1.5"
                onClick={() => {
                  changeOpen(false);
                  props.onCreate();
                }}
              >
                <Plus class="size-4" />
                Create agent
              </Button>
            </div>
          </MobileDrawer.ScrollBody>
        </MobileDrawer.Content>
      </MobileDrawer.Portal>
    </MobileDrawer>
  );
}
