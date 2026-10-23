import { fireAndForget } from '@core/util/fireAndForget';
import {
  Button,
  Dialog,
  Input,
  type ManagedDialogProps,
  SegmentedControl,
  Surface,
} from '@ui';
import {
  type Component,
  createResource,
  createSignal,
  For,
  Match,
  Show,
  Switch,
} from 'solid-js';
import {
  type ChipFor,
  KindPill,
  TemplateInstructions,
  TemplateLabel,
  TemplateTriggers,
} from '../components/template-parts';
import type {
  ShareDraft,
  ShareEdits,
  TemplateValue,
  TemplateVariable,
} from '../core/template';

export type ShareTemplateDialogProps = ManagedDialogProps & {
  routineName: string;
  label(value: TemplateValue): string;
  load(): Promise<ShareDraft>;
  /** Save the edits as a new template, or over `existingTemplateId`. */
  save(edits: ShareEdits, existingTemplateId?: string): Promise<string>;
  /** Picks recipients and sends the saved template to them. */
  Send: Component<{ templateId: string; name: string; onSent(): void }>;
};

/**
 * Share a routine as a template: review how it reads with each
 * person-specific value pulled out, choose which stay fixed, then send it.
 */
export function ShareTemplateDialog(props: ShareTemplateDialogProps) {
  const [draft] = createResource(() => props.load());
  const [edits, setEdits] = createSignal<ShareEdits>();
  const [savedId, setSavedId] = createSignal<string>();
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const current = (): ShareEdits | undefined => {
    const loaded = draft();
    return (
      edits() ??
      (loaded && {
        name: loaded.template.name,
        description: loaded.template.description,
        variables: loaded.template.variables,
      })
    );
  };

  function editVariable(key: string, change: Partial<TemplateVariable>) {
    const base = current();
    if (!base) return;
    setEdits({
      ...base,
      variables: base.variables.map((variable) =>
        variable.key === key ? { ...variable, ...change } : variable
      ),
    });
  }

  function setFixed(variable: TemplateVariable, fixed: boolean) {
    const value = draft()?.creatorValues[variable.key];
    editVariable(variable.key, { fixed: fixed ? value : undefined });
  }

  async function save(existing?: string) {
    const values = current();
    if (!values || saving()) return;
    setSaving(true);
    setError();
    try {
      setSavedId(await props.save(values, existing));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  const chipFor: ChipFor = (key) => {
    const variable = current()?.variables.find((v) => v.key === key);
    if (!variable) return;
    return variable.fixed
      ? { label: props.label(variable.fixed), tone: 'fixed' }
      : { label: variable.label, tone: 'variable' };
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => !saving() && props.onOpenChange(open)}
      class="w-250 max-w-[calc(100vw-16px)]"
      visibleScrim
    >
      <Surface depth={2} class="flex max-h-[85vh] flex-col rounded-xl text-ink">
        <header class="flex min-h-10 items-center gap-2 border-b border-edge-muted px-4 text-sm font-medium">
          <Dialog.Title class="flex min-w-0 items-center gap-2">
            <span>Share:</span>
            <span class="truncate">{props.routineName}</span>
          </Dialog.Title>
          <TemplateLabel>As a template</TemplateLabel>
        </header>
        <Switch>
          <Match when={savedId()}>
            {(id) => (
              <props.Send
                templateId={id()}
                name={current()?.name ?? props.routineName}
                onSent={() => props.onOpenChange(false)}
              />
            )}
          </Match>
          <Match when={draft.error}>
            <p role="alert" class="p-4 text-sm text-failure">
              Couldn't prepare this routine for sharing. Try again.
            </p>
          </Match>
          <Match when={!current()}>
            <p class="p-4 text-sm text-ink-muted">
              Finding the values that are yours…
            </p>
          </Match>
          <Match when={current()}>
            {(values) => (
              <>
                <div class="flex min-h-0 flex-1 flex-wrap overflow-y-auto">
                  <section
                    aria-label="How the template reads"
                    class="min-w-0 flex-[1_1_400px] border-edge-muted p-4 sm:border-r"
                  >
                    <h3 class="mb-2.5 text-xs font-medium text-ink-muted">
                      How the template reads
                    </h3>
                    <Input
                      aria-label="Template name"
                      class="mb-2 font-medium"
                      value={values().name}
                      maxLength={200}
                      onInput={(event) =>
                        setEdits({
                          ...values(),
                          name: event.currentTarget.value,
                        })
                      }
                    />
                    <Input
                      aria-label="Template description"
                      class="mb-3.5"
                      placeholder="What it does, for the people you share it with"
                      value={values().description}
                      maxLength={1000}
                      onInput={(event) =>
                        setEdits({
                          ...values(),
                          description: event.currentTarget.value,
                        })
                      }
                    />
                    <Show when={draft()}>
                      {(loaded) => (
                        <>
                          <TemplateTriggers
                            agentKey="agent"
                            lines={loaded().template.triggers}
                            chipFor={chipFor}
                          />
                          <div class="mt-3.5">
                            <TemplateInstructions
                              instructions={loaded().template.instructions}
                              chipFor={chipFor}
                            />
                          </div>
                        </>
                      )}
                    </Show>
                  </section>
                  <section
                    aria-label="Variables"
                    class="min-w-0 flex-[1_1_440px] p-4"
                  >
                    <div class="mb-1 flex flex-wrap items-baseline gap-2">
                      <h3 class="text-sm font-medium">Variables</h3>
                      <span class="text-xs text-ink-muted">
                        Found {values().variables.length} in your routine. Each
                        person gets their own.
                      </span>
                    </div>
                    <ul>
                      <For each={values().variables}>
                        {(variable) => (
                          <ShareVariableRow
                            variable={variable}
                            yours={draft()?.creatorValues[variable.key]}
                            label={props.label}
                            onEdit={(change) =>
                              editVariable(variable.key, change)
                            }
                            onFixed={(fixed) => setFixed(variable, fixed)}
                          />
                        )}
                      </For>
                    </ul>
                  </section>
                </div>
                <footer class="flex flex-wrap items-center gap-2 border-t border-edge-muted px-4 py-3">
                  <span class="min-w-60 flex-1 text-sm text-ink-muted">
                    <Show
                      when={error()}
                      fallback="Your values stay private. People see the variable names and fill in their own."
                    >
                      {(message) => (
                        <span role="alert" class="text-failure">
                          {message()}
                        </span>
                      )}
                    </Show>
                  </span>
                  <Button
                    variant="ghost"
                    depth={2}
                    disabled={saving()}
                    onClick={() => props.onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Show
                    when={draft()?.existingTemplateId}
                    fallback={
                      <Button
                        variant="strong"
                        depth={2}
                        disabled={saving() || !values().name.trim()}
                        onClick={() =>
                          fireAndForget(save(), 'routine-templates')
                        }
                      >
                        {saving() ? 'Saving…' : 'Share template'}
                      </Button>
                    }
                  >
                    {(existing) => (
                      <>
                        <Button
                          variant="outline"
                          depth={2}
                          disabled={saving()}
                          onClick={() => setSavedId(existing())}
                        >
                          Share existing
                        </Button>
                        <Button
                          variant="strong"
                          depth={2}
                          disabled={saving() || !values().name.trim()}
                          onClick={() =>
                            fireAndForget(save(existing()), 'routine-templates')
                          }
                        >
                          {saving() ? 'Saving…' : 'Update template'}
                        </Button>
                      </>
                    )}
                  </Show>
                </footer>
              </>
            )}
          </Match>
        </Switch>
      </Surface>
    </Dialog>
  );
}

function ShareVariableRow(props: {
  variable: TemplateVariable;
  yours?: TemplateValue;
  label(value: TemplateValue): string;
  onEdit(change: Partial<TemplateVariable>): void;
  onFixed(fixed: boolean): void;
}) {
  const canFix = () => props.variable.kind !== 'agent' && !!props.yours;
  const hint = () => {
    if (props.variable.fixed)
      return `Everyone gets ${props.label(props.variable.fixed)}.`;
    return props.yours ? `Yours: ${props.label(props.yours)}` : '';
  };
  return (
    <li class="grid gap-1.5 border-t border-edge-muted py-2.5">
      <div class="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Variable name"
          class="min-w-40 flex-1 text-sm font-medium"
          value={props.variable.label}
          maxLength={80}
          onInput={(event) =>
            props.onEdit({ label: event.currentTarget.value })
          }
        />
        <KindPill kind={props.variable.kind} />
        <Show
          when={canFix()}
          fallback={
            <span class="text-xs text-ink-muted">Each person chooses</span>
          }
        >
          <SegmentedControl
            size="sm"
            aria-label={`${props.variable.label}: variable or fixed`}
            value={props.variable.fixed ? 'fixed' : 'variable'}
            onChange={(value) => props.onFixed(value === 'fixed')}
            options={[
              { value: 'variable', label: 'Variable' },
              { value: 'fixed', label: 'Fixed' },
            ]}
          />
        </Show>
      </div>
      <Input
        aria-label={`Description of ${props.variable.label}`}
        class="text-xs"
        placeholder="One line for the person activating it"
        value={props.variable.description}
        maxLength={300}
        onInput={(event) =>
          props.onEdit({ description: event.currentTarget.value })
        }
      />
      <Show when={hint()}>
        <span class="text-xs text-ink-muted">{hint()}</span>
      </Show>
    </li>
  );
}
