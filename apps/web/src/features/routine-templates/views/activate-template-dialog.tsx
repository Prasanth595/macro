import { fireAndForget } from '@core/util/fireAndForget';
import PencilIcon from '@phosphor/pencil-simple.svg';
import { Button, Dialog, Input, type ManagedDialogProps, Surface } from '@ui';
import {
  type Component,
  createSignal,
  For,
  type JSX,
  onMount,
  Show,
} from 'solid-js';
import {
  Chip,
  type ChipFor,
  TemplateInstructions,
  TemplateLabel,
  TemplateTriggers,
} from '../components/template-parts';
import {
  type Bindings,
  type FilledRow,
  type FillResult,
  type RoutineTemplate,
  resolveBindings,
  type TemplateValue,
  type TemplateVariable,
} from '../core/template';

export type ValuePickerProps = {
  variable: TemplateVariable;
  value?: TemplateValue;
  onPick(value: TemplateValue): void;
};

export type ActivateTemplateDialogProps = ManagedDialogProps & {
  template: RoutineTemplate;
  ownerName: string;
  /** Labels a value for chips and rows. */
  label(value: TemplateValue): string;
  /** Values already chosen (the routine's bindings when rebinding). */
  initial?: Bindings;
  /** Start an AI fill as soon as the dialog opens. */
  fillOnOpen: boolean;
  title: string;
  submitLabel: string;
  fill(instruction: string | undefined, current: Bindings): Promise<FillResult>;
  submit(bindings: Bindings, name: string | undefined): Promise<void>;
  Picker: Component<ValuePickerProps>;
};

const READING_NOTICE =
  'Reading your inbox, channels, docs and agents to fill this in. Nothing is saved yet.';

/**
 * Review a template's variables before it becomes the viewer's routine. An
 * AI fill proposes a value for each from the viewer's own workspace; every
 * value can be changed by hand.
 */
export function ActivateTemplateDialog(props: ActivateTemplateDialogProps) {
  const [chosen, setChosen] = createSignal<Bindings>({ ...props.initial });
  const [rows, setRows] = createSignal<Record<string, FilledRow>>({});
  const [filling, setFilling] = createSignal(false);
  const [fillError, setFillError] = createSignal(false);
  const [name, setName] = createSignal<string>();
  const [editing, setEditing] = createSignal<string>();
  const [instruction, setInstruction] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [submitError, setSubmitError] = createSignal<string>();

  const resolved = () => resolveBindings(props.template.variables, chosen());
  const canSubmit = () =>
    !filling() && !submitting() && resolved().missing.length === 0;

  async function fill(ask?: string) {
    setFilling(true);
    setFillError(false);
    try {
      const result = await props.fill(ask, chosen());
      const next = { ...chosen() };
      for (const row of result.rows) if (row.value) next[row.key] = row.value;
      setChosen(next);
      setRows(Object.fromEntries(result.rows.map((row) => [row.key, row])));
      if (result.name) setName(result.name);
    } catch {
      setFillError(true);
    } finally {
      setFilling(false);
    }
  }

  onMount(() => {
    if (props.fillOnOpen) fireAndForget(fill(), 'routine-templates');
  });

  function pick(variable: TemplateVariable, value: TemplateValue) {
    setChosen({ ...chosen(), [variable.key]: value });
    setRows({ ...rows(), [variable.key]: { key: variable.key } });
    setEditing();
  }

  async function submit() {
    if (!canSubmit()) return;
    setSubmitting(true);
    setSubmitError();
    try {
      await props.submit(resolved().bindings, name());
      props.onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const chipFor: ChipFor = (key) => {
    const variable = props.template.variables.find((v) => v.key === key);
    if (!variable) return;
    const own = chosen()[key];
    const value = own ?? variable.fixed;
    if (!value) return { label: variable.label, tone: 'variable' };
    if (!own) return { label: props.label(value), tone: 'fixed' };
    return {
      label: props.label(value),
      tone: rows()[key]?.check ? 'check' : 'filled',
    };
  };

  const status = () =>
    filling()
      ? 'Filling in…'
      : `Filled in ${props.template.variables.length - resolved().missing.length} of ${props.template.variables.length}`;

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => !submitting() && props.onOpenChange(open)}
      class="w-255 max-w-[calc(100vw-16px)]"
      visibleScrim
    >
      <Surface depth={2} class="flex max-h-[85vh] flex-col rounded-xl text-ink">
        <header class="flex min-h-10 flex-wrap items-center gap-2 border-b border-edge-muted px-4 py-2 text-sm font-medium">
          <Dialog.Title class="flex min-w-0 items-center gap-2">
            <span>{props.title}</span>
            <span class="truncate">{props.template.name}</span>
          </Dialog.Title>
          <TemplateLabel>Template by {props.ownerName}</TemplateLabel>
          <span class="flex-1" />
          <span role="status" class="text-xs font-normal text-ink-muted">
            {status()}
          </span>
        </header>

        <div class="flex min-h-0 flex-1 flex-wrap overflow-y-auto">
          <section
            aria-label="Your routine"
            class="min-w-0 flex-[1_1_400px] border-edge-muted p-4 sm:border-r"
          >
            <h3 class="mb-2.5 text-xs font-medium text-ink-muted">
              Your routine
            </h3>
            <TemplateTriggers
              agentKey="agent"
              lines={props.template.triggers}
              chipFor={chipFor}
            />
            <div class="mt-4">
              <TemplateInstructions
                instructions={props.template.instructions}
                chipFor={chipFor}
              />
            </div>
            <Legend />
          </section>

          <section
            aria-label="What we filled in"
            class="min-w-0 flex-[1_1_460px] p-4"
          >
            <div class="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <h3 class="text-sm font-medium">What we filled in</h3>
              <Button
                variant="ghost"
                size="sm"
                depth={2}
                disabled={filling()}
                onClick={() => fireAndForget(fill(), 'routine-templates')}
              >
                Fill in again
              </Button>
            </div>
            <Show when={fillError()}>
              <p role="alert" class="py-2 text-sm text-failure">
                Couldn't fill this in automatically. Choose each value below.
              </p>
            </Show>
            <ul>
              <For each={props.template.variables}>
                {(variable) => (
                  <VariableRow
                    variable={variable}
                    value={chosen()[variable.key] ?? variable.fixed}
                    fixed={!chosen()[variable.key] && !!variable.fixed}
                    row={rows()[variable.key]}
                    loading={filling() && !chosen()[variable.key]}
                    editing={editing() === variable.key}
                    label={props.label}
                    chipFor={chipFor}
                    onEdit={() =>
                      setEditing(
                        editing() === variable.key ? undefined : variable.key
                      )
                    }
                    picker={
                      <props.Picker
                        variable={variable}
                        value={chosen()[variable.key] ?? variable.fixed}
                        onPick={(value) => pick(variable, value)}
                      />
                    }
                  />
                )}
              </For>
            </ul>
            <form
              class="mt-3.5 flex items-center gap-2 rounded-lg border border-edge-muted bg-panel px-2.5 py-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                const ask = instruction().trim();
                if (!ask || filling()) return;
                setInstruction('');
                fireAndForget(fill(ask), 'routine-templates');
              }}
            >
              <PencilIcon class="size-4 text-ink-muted" aria-hidden="true" />
              <Input
                aria-label="Ask for changes"
                class="flex-1 border-0 bg-transparent"
                placeholder='Ask for changes, like "do this for Initech instead"'
                value={instruction()}
                maxLength={1000}
                disabled={filling()}
                onInput={(event) => setInstruction(event.currentTarget.value)}
              />
            </form>
          </section>
        </div>

        <footer class="flex flex-wrap items-center gap-2 border-t border-edge-muted px-4 py-3">
          <span class="min-w-60 flex-1 text-sm text-ink-muted">
            <Show
              when={submitError()}
              fallback={
                filling()
                  ? READING_NOTICE
                  : 'Check the amber ones. This creates your own routine that runs as you.'
              }
            >
              {(error) => (
                <span role="alert" class="text-failure">
                  {error()}
                </span>
              )}
            </Show>
          </span>
          <Button
            variant="ghost"
            depth={2}
            disabled={submitting()}
            onClick={() => props.onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="strong"
            depth={2}
            disabled={!canSubmit()}
            onClick={() => fireAndForget(submit(), 'routine-templates')}
          >
            {submitting() ? 'Saving…' : props.submitLabel}
          </Button>
        </footer>
      </Surface>
    </Dialog>
  );
}

function VariableRow(props: {
  variable: TemplateVariable;
  value?: TemplateValue;
  fixed: boolean;
  row?: FilledRow;
  loading: boolean;
  editing: boolean;
  label(value: TemplateValue): string;
  chipFor: ChipFor;
  onEdit(): void;
  picker: JSX.Element;
}) {
  const note = () =>
    props.loading
      ? 'Looking through your inbox, channels and docs…'
      : (props.row?.problem ??
        props.row?.reason ??
        (props.fixed ? 'Same for everyone.' : props.variable.description));
  return (
    <li class="grid grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5 border-t border-edge-muted py-2.5">
      <span class="text-xs text-ink-muted">{props.variable.label}</span>
      <span class="min-w-0 text-sm">
        <Show
          when={!props.loading}
          fallback={
            <span class="inline-block h-3.5 w-3/5 animate-pulse rounded-sm bg-hover" />
          }
        >
          <Chip key={props.variable.key} chipFor={props.chipFor} />
          <Show when={props.value && props.row?.check}>
            <span class="ml-1.5 rounded-full bg-warning/15 px-1.5 text-xxs font-semibold text-warning">
              Check this
            </span>
          </Show>
        </Show>
      </span>
      <Button
        variant="ghost"
        size="sm"
        depth={2}
        disabled={props.loading}
        aria-label={`Change ${props.variable.label}`}
        aria-expanded={props.editing}
        onClick={props.onEdit}
      >
        Change
      </Button>
      <span
        class="col-start-2 col-end-4 text-xs leading-snug"
        classList={{
          'text-failure': !!props.row?.problem && !props.loading,
          'text-ink-muted': !props.row?.problem || props.loading,
        }}
      >
        {note()}
      </span>
      <Show when={props.editing}>
        <div class="col-span-3 pt-2">{props.picker}</div>
      </Show>
    </li>
  );
}

function Legend() {
  return (
    <div class="mt-4 flex flex-wrap gap-3.5 text-xs text-ink-muted">
      <span class="inline-flex items-center gap-1.5">
        <span class="rounded-sm bg-link/15 px-1 text-link">blue</span>
        filled in for you
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="rounded-sm bg-warning/12 px-1 text-warning">amber</span>
        worth a check
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="rounded-sm bg-hover px-1 text-ink">grey</span>
        same for everyone
      </span>
    </div>
  );
}
