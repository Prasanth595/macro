import ArrowRightIcon from '@phosphor/arrow-right.svg';
import CheckIcon from '@phosphor/check-circle.svg';
import DotsIcon from '@phosphor/dots-three.svg';
import PlayIcon from '@phosphor/play.svg';
import TrashIcon from '@phosphor/trash-simple.svg';
import { Button, Dropdown } from '@ui';
import { Show } from 'solid-js';
import {
  type ChipFor,
  TemplateInstructions,
  TemplateLabel,
  TemplateTriggers,
  TemplateVariableList,
} from '../components/template-parts';
import type { RoutineTemplate, TemplateValue } from '../core/template';

export type TemplatePageProps = {
  template: RoutineTemplate;
  ownerName: string;
  isOwner: boolean;
  label(value: TemplateValue): string;
  onActivate(): void;
  onOpenRoutine(id: string): void;
  onDelete(): void;
};

/** A shared routine template: what it does, and Activate for me. */
export function TemplatePage(props: TemplatePageProps) {
  const chipFor: ChipFor = (key) => {
    const variable = props.template.variables.find((v) => v.key === key);
    if (!variable) return;
    return variable.fixed
      ? { label: props.label(variable.fixed), tone: 'fixed' }
      : { label: variable.label, tone: 'variable' };
  };
  const summary = () => {
    const count = props.template.variables.length;
    const active = props.template.activationCount;
    return [
      `By ${props.ownerName}`,
      `${count} ${count === 1 ? 'variable' : 'variables'}`,
      active ? `active for ${active}` : undefined,
    ]
      .filter(Boolean)
      .join(' · ');
  };
  const yours = () => props.template.yourActivations;

  return (
    <div class="size-full overflow-y-auto px-6 py-8 touch:pt-[calc(var(--mobile-content-inset-top,0px)+2rem)]">
      <div class="mx-auto max-w-260">
        <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-2">
          <div class="flex min-h-16 items-center gap-3 rounded-xl border border-dashed border-accent/60 bg-accent/8 px-3.5 py-3">
            <span class="flex flex-col gap-0.5 leading-snug">
              <span class="flex items-center gap-2 text-[15px] font-semibold">
                Routine template
                <TemplateLabel />
              </span>
              <span class="text-sm text-ink-muted">{summary()}</span>
            </span>
            <span class="flex-1" />
            <Show when={props.isOwner}>
              <Dropdown placement="bottom-end">
                <Dropdown.Trigger
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Template actions"
                >
                  <DotsIcon class="size-5" />
                </Dropdown.Trigger>
                <Dropdown.Content portalScope="local">
                  <Dropdown.Item onSelect={props.onDelete}>
                    <TrashIcon class="size-4" />
                    Delete template
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown>
            </Show>
          </div>
          <div class="flex min-h-16 flex-col justify-center gap-2 rounded-xl bg-ink px-3.5 py-3 text-surface">
            <Show when={yours().length}>
              <span class="flex items-center gap-2 text-sm">
                <CheckIcon class="size-4" aria-hidden="true" />
                Active for you
                <button
                  type="button"
                  class="underline underline-offset-2"
                  onClick={() => props.onOpenRoutine(yours()[0])}
                >
                  Open your routine
                </button>
              </span>
            </Show>
            <button
              type="button"
              class="flex items-center gap-3 text-left"
              onClick={() => props.onActivate()}
            >
              <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface/10">
                <PlayIcon class="size-4" aria-hidden="true" />
              </span>
              <span class="flex flex-1 flex-col gap-0.5 leading-snug">
                <span class="text-[15px] font-semibold">
                  {yours().length ? 'Activate again' : 'Activate for me'}
                </span>
                <span class="text-sm opacity-70">
                  We fill in the variables for you. You review first.
                </span>
              </span>
              <ArrowRightIcon class="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <h1 class="mt-7 text-2xl font-semibold">{props.template.name}</h1>
        <Show when={props.template.description}>
          <p class="mt-1.5 leading-normal text-ink-muted">
            {props.template.description}
          </p>
        </Show>

        <div class="mt-6 flex flex-wrap items-start gap-6">
          <div class="min-w-0 flex-[999_1_460px]">
            <h2 class="mb-2 text-xs font-medium text-ink-muted">Runs</h2>
            <section
              aria-label="Template triggers"
              class="rounded-xl border border-dashed border-edge-muted px-4 py-3.5"
            >
              <TemplateTriggers
                agentKey="agent"
                lines={props.template.triggers}
                chipFor={chipFor}
              />
            </section>
            <h2 class="mt-5.5 mb-2 text-xs font-medium text-ink-muted">
              Instructions
            </h2>
            <section aria-label="Template instructions">
              <TemplateInstructions
                instructions={props.template.instructions}
                chipFor={chipFor}
              />
            </section>
          </div>
          <aside
            aria-label="Variables"
            class="grid min-w-0 flex-[1_1_320px] gap-2"
          >
            <div class="flex items-baseline justify-between text-xs text-ink-muted">
              <span class="font-medium">
                Variables · {props.template.variables.length}
              </span>
              <span>Filled in for you on activate</span>
            </div>
            <TemplateVariableList
              variables={props.template.variables}
              chipFor={chipFor}
            />
            <Button
              class="mt-2 sm:hidden"
              variant="strong"
              onClick={() => props.onActivate()}
            >
              Activate for me
            </Button>
          </aside>
        </div>
      </div>
    </div>
  );
}
