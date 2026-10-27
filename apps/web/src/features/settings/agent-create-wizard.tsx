import { fireAndForget } from '@core/util/fireAndForget';
import ArrowRightIcon from '@icon/system/regular/arrow-right.svg';
import CaretDownIcon from '@icon/system/regular/caret-down.svg';
import ChatIcon from '@icon/system/regular/chat-circle.svg';
import UploadIcon from '@icon/system/regular/upload-simple.svg';
import { Button, cn } from '@ui';
import { createSignal, For, type JSX, Match, Show, Switch } from 'solid-js';
import { match } from 'ts-pattern';
import { AgentFace, createDarkTheme } from './components/agent-face';
import { AgentMentionShowcase } from './components/agent-mention-showcase';
import { AgentWizard } from './components/agent-wizard';
import {
  AGENT_FACE_COLORS,
  AGENT_FACE_STYLES,
  type AgentFaceLook,
  agentFaceColor,
} from './core/agent-face';
import { SettingsSurface } from './primitives';

const WIZARD_STEPS = [
  'look',
  'name',
  'instructions',
  'where',
  'share',
  'channels',
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];
type FieldStep = Exclude<WizardStep, 'look'>;

const pick = <T,>(items: readonly T[]) =>
  items[Math.floor(Math.random() * items.length)];

/**
 * Creates an agent one question at a time: its face, name, instructions,
 * where it runs, who can use it, and where people meet it, then a ready
 * screen. Each step shows the same fields as the edit form; the rest of
 * Advanced folds under "More options".
 */
export function AgentCreateWizard(props: {
  name: string;
  tag: string;
  avatarUrl?: string;
  pending: boolean;
  busy: boolean;
  uploadingAvatar: boolean;
  canContinue: (step: WizardStep) => boolean;
  fields: Record<FieldStep | 'advanced', () => JSX.Element>;
  advancedSummary: string;
  onUploadAvatar: (file: File | undefined) => Promise<void>;
  onClearAvatar: () => void;
  /**
   * Creates the agent wearing `face` (unless a picture was uploaded),
   * resolving to its id, or `undefined` when it failed.
   */
  onCreate: (face: AgentFaceLook) => Promise<string | undefined>;
  onClose: () => void;
  onMessage?: (agentId: string) => void;
  /** Where connection flows opened from a step mount their UI. */
  contentRef: (element: HTMLDivElement) => void;
}) {
  const [step, setStep] = createSignal<WizardStep>('look');
  const [look, setLook] = createSignal<AgentFaceLook>({
    style: pick(AGENT_FACE_STYLES).id,
    color: pick(AGENT_FACE_COLORS).id,
  });
  const [createdId, setCreatedId] = createSignal<string>();
  const [moreOpen, setMoreOpen] = createSignal(false);
  const dark = createDarkTheme();
  let avatarInput: HTMLInputElement | undefined;
  const displayName = () => props.name.trim() || 'your agent';
  const stepIndex = () =>
    createdId() ? WIZARD_STEPS.length : WIZARD_STEPS.indexOf(step());
  const swatch = () =>
    agentFaceColor(look().color).swatch[dark() ? 'dark' : 'light'];

  // Clear the input afterwards so choosing the same file again still uploads.
  const uploadAvatar = async (input: HTMLInputElement) => {
    await props.onUploadAvatar(input.files?.[0]);
    input.value = '';
  };
  const create = async () => {
    const created = await props.onCreate(look());
    if (created) setCreatedId(created);
  };
  const advance = () => {
    if (createdId()) {
      props.onClose();
      return;
    }
    if (!props.canContinue(step())) return;
    const next = WIZARD_STEPS[WIZARD_STEPS.indexOf(step()) + 1];
    if (next) setStep(next);
    else fireAndForget(create(), 'agent-settings');
  };
  const goBack = () => {
    const previous = WIZARD_STEPS[WIZARD_STEPS.indexOf(step()) - 1];
    return previous && !createdId() ? () => setStep(previous) : undefined;
  };

  const title = () => {
    if (createdId()) return `${displayName()} is ready`;
    return match(step())
      .with('look', () => 'Meet your new agent')
      .with('name', () => 'What’s its name?')
      .with('instructions', () => `What should ${displayName()} do?`)
      .with('where', () => 'Where should it run?')
      .with('share', () => 'Who can use it?')
      .with('channels', () => `Work with ${displayName()} anywhere`)
      .exhaustive();
  };
  const description = () => {
    if (createdId())
      return `Mention @${props.tag} anywhere, or message it directly.`;
    return match(step())
      .with(
        'look',
        () => 'Pick a face and a color. It’s how your team spots it at work.'
      )
      .with(
        'name',
        () => 'Your team mentions it by its @tag, like any teammate.'
      )
      .with(
        'instructions',
        () =>
          'It reads these at the start of every conversation. You can change them later.'
      )
      .with(
        'where',
        () => 'Pick where it does its work and which model it uses.'
      )
      .with(
        'share',
        () => 'Private agents are yours. Team agents work in shared channels.'
      )
      .with(
        'channels',
        () =>
          `Mention @${props.tag} in a doc, a CRM record, or a task, or assign it work like a teammate. Then pick the channels it joins.`
      )
      .exhaustive();
  };

  const hero = () => (
    <Show
      when={props.avatarUrl}
      fallback={
        <AgentFace
          look={look()}
          animated
          followPointer
          state={props.pending ? 'thinking' : createdId() ? 'done' : 'idle'}
          class={cn(
            'transition-[width,height] duration-300',
            step() === 'look' && !createdId()
              ? 'size-36 sm:size-44'
              : 'size-28 sm:size-32'
          )}
        />
      }
    >
      {(url) => (
        <img
          src={url()}
          alt={`${displayName()} avatar`}
          class="size-24 rounded-full object-cover ring ring-edge-muted"
        />
      )}
    </Show>
  );

  return (
    <AgentWizard
      label="New agent"
      accent={swatch()}
      step={stepIndex()}
      stepCount={WIZARD_STEPS.length}
      busy={props.busy}
      onBack={goBack()}
      onCancel={createdId() ? undefined : props.onClose}
      onSubmit={advance}
      title={title()}
      description={description()}
      hero={hero()}
      actions={
        <Show
          when={createdId()}
          fallback={
            <Button
              type="submit"
              variant="cta"
              size="xl"
              class="min-w-44"
              disabled={!props.canContinue(step())}
            >
              <Show
                when={step() === 'channels'}
                fallback={
                  <>
                    Continue
                    <ArrowRightIcon />
                  </>
                }
              >
                {props.pending ? 'Creating…' : 'Create agent'}
              </Show>
            </Button>
          }
        >
          {(created) => (
            <div class="flex flex-col items-center gap-2">
              <Button type="submit" variant="cta" size="xl" class="min-w-44">
                Done
              </Button>
              <Show when={props.onMessage}>
                {(onMessage) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => onMessage()(created())}
                  >
                    <ChatIcon />
                    Message {displayName()}
                  </Button>
                )}
              </Show>
            </div>
          )}
        </Show>
      }
    >
      <div class="@container" ref={props.contentRef}>
        <Switch>
          <Match when={createdId()}>{null}</Match>
          <Match when={step() === 'look'}>
            <Show when={!props.avatarUrl}>
              <FacePicker look={look()} onChange={setLook} />
            </Show>
            <div class="mt-5 flex flex-wrap items-center justify-center gap-1">
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                class="hidden"
                disabled={props.busy}
                onChange={(event) =>
                  fireAndForget(
                    uploadAvatar(event.currentTarget),
                    'agent-settings'
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="md"
                disabled={props.busy}
                onClick={() => avatarInput?.click()}
              >
                <UploadIcon />
                {props.uploadingAvatar
                  ? 'Uploading…'
                  : props.avatarUrl
                    ? 'Change picture'
                    : 'Upload a picture instead'}
              </Button>
              <Show when={props.avatarUrl}>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  disabled={props.busy}
                  onClick={props.onClearAvatar}
                >
                  Use a face
                </Button>
              </Show>
            </div>
          </Match>
          <Match when={step() === 'name'}>{props.fields.name()}</Match>
          <Match when={step() === 'instructions'}>
            {props.fields.instructions()}
          </Match>
          <Match when={step() === 'where'}>{props.fields.where()}</Match>
          <Match when={step() === 'share'}>
            {props.fields.share()}
            <div class="mt-5 flex flex-col items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="md"
                aria-expanded={moreOpen()}
                aria-controls="agent-advanced"
                onClick={() => setMoreOpen((open) => !open)}
              >
                More options
                <CaretDownIcon
                  class={cn(
                    'transition-transform duration-200',
                    moreOpen() && 'rotate-180'
                  )}
                />
              </Button>
              <p class="text-xs text-ink-muted">{props.advancedSummary}</p>
            </div>
            <Show when={moreOpen()}>
              <SettingsSurface class="mt-3 p-4">
                {props.fields.advanced()}
              </SettingsSurface>
            </Show>
          </Match>
          <Match when={step() === 'channels'}>
            <AgentMentionShowcase
              name={displayName()}
              tag={props.tag}
              look={look()}
            />
            <h2 class="mt-8 mb-3 text-sm font-medium text-ink">
              Which channels can mention it?
            </h2>
            {props.fields.channels()}
          </Match>
        </Switch>
      </div>
    </AgentWizard>
  );
}

/**
 * The face and color choices, as two radio groups: faces drawn in the chosen
 * color, then color swatches.
 */
function FacePicker(props: {
  look: AgentFaceLook;
  onChange: (look: AgentFaceLook) => void;
}) {
  const dark = createDarkTheme();
  return (
    <div class="flex flex-col items-center gap-5">
      <fieldset class="w-full">
        <legend class="sr-only">Face</legend>
        <div class="flex justify-center gap-2">
          <For each={AGENT_FACE_STYLES}>
            {(style) => (
              <label class="group flex flex-col items-center gap-1.5">
                <span
                  class={cn(
                    'flex size-14 items-center justify-center rounded-2xl border border-edge-muted bg-panel/60 transition-[border-color,box-shadow,transform] duration-200',
                    'not-touch:group-hover:border-ink/30 group-has-focus-visible:outline-2 group-has-focus-visible:outline-offset-2 group-has-focus-visible:outline-ink',
                    'group-has-checked:border-ink group-has-checked:shadow-[0_0_0_1px_var(--color-ink)] sm:size-16'
                  )}
                >
                  <input
                    type="radio"
                    name="agent-face-style"
                    value={style.id}
                    class="sr-only"
                    checked={props.look.style === style.id}
                    onChange={() =>
                      props.onChange({ ...props.look, style: style.id })
                    }
                  />
                  <AgentFace
                    look={{ ...props.look, style: style.id }}
                    class="size-11 sm:size-12"
                  />
                </span>
                <span class="text-xs text-ink-muted group-has-checked:text-ink">
                  {style.label}
                </span>
              </label>
            )}
          </For>
        </div>
      </fieldset>
      <fieldset>
        <legend class="sr-only">Color</legend>
        <div class="flex justify-center gap-2.5">
          <For each={AGENT_FACE_COLORS}>
            {(color) => (
              <label
                class={cn(
                  'group flex size-9 items-center justify-center rounded-full transition-shadow duration-200 touch:size-11',
                  'has-checked:shadow-[0_0_0_2px_var(--color-ink)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink'
                )}
              >
                <input
                  type="radio"
                  name="agent-face-color"
                  value={color.id}
                  aria-label={color.label}
                  class="sr-only"
                  checked={props.look.color === color.id}
                  onChange={() =>
                    props.onChange({ ...props.look, color: color.id })
                  }
                />
                <span
                  class="size-6 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] transition-transform duration-200 not-touch:group-hover:scale-110 touch:size-7"
                  style={{
                    background: color.swatch[dark() ? 'dark' : 'light'],
                  }}
                />
              </label>
            )}
          </For>
        </div>
      </fieldset>
    </div>
  );
}
